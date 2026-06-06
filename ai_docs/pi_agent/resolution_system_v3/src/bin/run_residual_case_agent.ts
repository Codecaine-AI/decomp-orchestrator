import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, extname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runReviewAgent } from "../../../resolution_system/src/pi_runner.js";
import { readJson, writeJson } from "../io/json.js";
import { atomicWriteFile } from "../io/atomic.js";
import type {
  AgentConfig,
  ReviewAgentCustomTool,
  ReviewAgentToolContent,
  ThinkingLevel,
} from "../../../resolution_system/src/pi_runner.js";
import type { V3ResidualCaseObject, V3ResidualCaseReview } from "../types.js";

interface Args {
  objectsDir: string;
  objectId: string;
  provider: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  dryRun: boolean;
  gridOverlay: boolean;
  gridOverlayDir?: string;
  alignmentResiduals: boolean;
  maxAlignmentPairs: number;
}

interface PromptImage {
  content: {
    type: "image";
    data: string;
    mimeType: string;
  };
}

type JsonObject = Record<string, unknown>;

interface AlignmentResidualPair {
  left_path: string;
  right_path: string;
  left_filename: string;
  right_filename: string;
  relationship: string;
  left_group_id?: string;
  right_group_id?: string;
  candidate_id?: string;
}

interface AlignmentProbeRequestPair {
  left_filename: string;
  right_filename: string;
  reason?: string;
  focus_regions?: string[];
}

interface AlignmentProbeParams {
  pairs: AlignmentProbeRequestPair[];
  audit_size?: number;
  sheet_pairs?: number;
}

interface AlignmentProbeMetric {
  rank: number;
  left_filename: string;
  right_filename: string;
  relationship: string;
  risk: "high" | "medium" | "low" | "unknown";
  aligned_corr: number | null;
  mean_abs_diff: number | null;
  p95_abs_diff: number | null;
  p99_abs_diff: number | null;
  strong_diff_fraction: number | null;
  edge_delta_fraction: number | null;
  risk_score: number;
}

interface AlignmentProbeCall {
  call_id: string;
  manifest_path: string;
  output_path: string;
  requested_pair_count: number;
  rendered_pair_count: number;
  skipped_pairs: string[];
  metrics: Omit<AlignmentProbeMetric, "risk_score">[];
}

interface AlignmentProbeToolState {
  tool: ReviewAgentCustomTool;
  calls: AlignmentProbeCall[];
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "../../..");
const systemRoot = resolve(repoRoot, "resolution_system_v3");
const gridOverlayScriptPath = resolve(systemRoot, "scripts/render_grid_overlay.py");
const alignmentResidualScriptPath = resolve(systemRoot, "scripts/render_alignment_residuals.py");
const defaultMaxAlignmentPairs = 36;
const maxAlignmentProbePairs = 8;

const allowedViewerDecisions = new Set([
  "algorithm_issue",
  "merge_truth_groups",
  "split_truth_group",
  "move_to_candidate_group",
  "remove_image_from_dataset",
  "needs_more_review",
  "insufficient_evidence",
]);

function usage(): string {
  return [
    "Usage:",
    "  bun run run-agent -- [--object-id <case_id>] [--objects-dir <path>] [--provider <name>] [--model <name>] [--thinking-level xhigh] [--no-grid-overlay] [--no-alignment-residuals] [--dry-run]",
    "",
    "Defaults:",
    "  --objects-dir outputs/residual_case_preflight",
    "  --provider codex-lb",
    "  --model gpt-5.5",
    "  --thinking-level xhigh",
    "  gray 3x3 grid overlays enabled",
    "  generated alignment residual sheets enabled",
  ].join("\n");
}

function resolveFromSystemRoot(pathValue: string): string {
  return isAbsolute(pathValue) ? pathValue : resolve(systemRoot, pathValue);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    objectsDir: resolve(systemRoot, "outputs/residual_case_preflight"),
    objectId: "case_bd36dd2bfefa",
    provider: "codex-lb",
    model: "gpt-5.5",
    thinkingLevel: "xhigh",
    dryRun: false,
    gridOverlay: true,
    alignmentResiduals: true,
    maxAlignmentPairs: defaultMaxAlignmentPairs,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };

    if (arg === "--objects-dir") args.objectsDir = resolveFromSystemRoot(next());
    else if (arg === "--object-id") args.objectId = next();
    else if (arg === "--provider") args.provider = next();
    else if (arg === "--model") args.model = next();
    else if (arg === "--thinking-level") args.thinkingLevel = next() as ThinkingLevel;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--grid-overlay") args.gridOverlay = true;
    else if (arg === "--no-grid-overlay") args.gridOverlay = false;
    else if (arg === "--grid-overlay-dir") args.gridOverlayDir = resolveFromSystemRoot(next());
    else if (arg === "--alignment-residuals") args.alignmentResiduals = true;
    else if (arg === "--no-alignment-residuals") args.alignmentResiduals = false;
    else if (arg === "--max-alignment-pairs") args.maxAlignmentPairs = positiveInt(next(), "--max-alignment-pairs");
    else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }

  if (!isAllowedPiProvider(args.provider)) {
    throw new Error(`Refusing non-OpenAI-compatible Pi provider for this run: ${args.provider}`);
  }
  return args;
}

function positiveInt(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function isAllowedPiProvider(provider: string): boolean {
  const normalized = provider.toLowerCase();
  return normalized.includes("openai") || normalized === "codex-lb";
}

function objectPath(args: Args): string {
  return resolve(args.objectsDir, "objects", args.objectId, "case_object.json");
}

function mimeTypeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function imageFromPath(path: string): Promise<PromptImage | null> {
  if (!existsSync(path)) return null;
  const bytes = await readFile(path);
  return {
    content: {
      type: "image",
      data: bytes.toString("base64"),
      mimeType: mimeTypeFor(path),
    },
  };
}

function imagePathForOverlay(sourcePath: string, outputDir: string, index: number, explicitDir?: string): string {
  const originalExt = extname(sourcePath).toLowerCase();
  const ext = [".jpg", ".jpeg", ".png", ".webp"].includes(originalExt) ? originalExt : ".jpg";
  const name = basename(sourcePath, extname(sourcePath))
    .replaceAll(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  const root = explicitDir ?? resolve(outputDir, "grid_overlay_images");
  return resolve(root, `${String(index + 1).padStart(3, "0")}_${name}${ext}`);
}

function shouldApplyGridOverlay(image: V3ResidualCaseObject["attached_images"][number]): boolean {
  return image.exists && (image.role === "truth_frame" || image.role === "candidate_frame");
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function buildAlignmentResidualPairs(object: V3ResidualCaseObject, maxPairs: number): AlignmentResidualPair[] {
  const filenameToPath = new Map<string, string>();
  for (const image of object.attached_images) {
    if (!image.exists || !image.filename) continue;
    if (image.role !== "truth_frame" && image.role !== "candidate_frame") continue;
    if (!filenameToPath.has(image.filename)) filenameToPath.set(image.filename, image.source_path);
  }

  const groupByFilename = new Map<string, string>();
  for (const group of object.truth_groups) {
    for (const filename of group.filenames) groupByFilename.set(filename, group.group_id);
  }

  const pairs: AlignmentResidualPair[] = [];
  const seen = new Set<string>();
  const addPair = (left: string, right: string, relationship: string, candidateId?: string) => {
    if (pairs.length >= maxPairs) return;
    if (!left || !right || left === right) return;
    const leftPath = filenameToPath.get(left);
    const rightPath = filenameToPath.get(right);
    if (!leftPath || !rightPath) return;
    const key = [left, right].sort().join("\0");
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({
      left_path: leftPath,
      right_path: rightPath,
      left_filename: left,
      right_filename: right,
      relationship,
      left_group_id: groupByFilename.get(left),
      right_group_id: groupByFilename.get(right),
      candidate_id: candidateId,
    });
  };

  const present = (filenames: string[]) => uniqueStrings(filenames).filter((filename) => filenameToPath.has(filename));
  const firstPresent = (filenames: string[]): string | undefined => present(filenames)[0];

  for (const [partIndex, part] of object.prediction_parts.entries()) {
    const files = present(part);
    for (let index = 0; index + 1 < files.length && pairs.length < maxPairs; index += 1) {
      const left = files[index];
      const right = files[index + 1];
      const leftGroup = groupByFilename.get(left) ?? "unknown";
      const rightGroup = groupByFilename.get(right) ?? "unknown";
      const relationship =
        leftGroup !== rightGroup
          ? `prediction part ${partIndex + 1} crosses truth groups ${leftGroup} / ${rightGroup}`
          : `prediction part ${partIndex + 1} internal adjacency`;
      addPair(left, right, relationship);
    }

    const filesByGroup = new Map<string, string[]>();
    for (const filename of files) {
      const groupId = groupByFilename.get(filename) ?? "unknown";
      const values = filesByGroup.get(groupId) ?? [];
      values.push(filename);
      filesByGroup.set(groupId, values);
    }
    const grouped = [...filesByGroup.entries()];
    for (let index = 0; index + 1 < grouped.length && pairs.length < maxPairs; index += 1) {
      const [leftGroup, leftFiles] = grouped[index];
      const [rightGroup, rightFiles] = grouped[index + 1];
      addPair(leftFiles[0], rightFiles[0], `prediction merge boundary ${leftGroup} / ${rightGroup}`);
    }
  }

  for (let index = 0; index + 1 < object.prediction_parts.length && pairs.length < maxPairs; index += 1) {
    const left = firstPresent(object.prediction_parts[index] ?? []);
    const right = firstPresent(object.prediction_parts[index + 1] ?? []);
    if (left && right) addPair(left, right, `prediction split boundary parts ${index + 1} / ${index + 2}`);
  }

  for (const group of object.truth_groups) {
    const files = present(group.filenames);
    if (files.length < 2) continue;
    addPair(files[0], files[files.length - 1], `current truth group ${group.group_id} first/last span`);
    for (let index = 0; index + 1 < files.length && pairs.length < maxPairs; index += 1) {
      addPair(files[index], files[index + 1], `current truth group ${group.group_id} internal adjacency`);
    }
  }

  const truthGroups = object.truth_groups
    .map((group) => ({ group, files: present(group.filenames) }))
    .filter((entry) => entry.files.length > 0);
  for (let index = 0; index + 1 < truthGroups.length && pairs.length < maxPairs; index += 1) {
    const left = truthGroups[index];
    const right = truthGroups[index + 1];
    addPair(left.files[0], right.files[0], `current truth group boundary ${left.group.group_id} / ${right.group.group_id}`);
  }

  const caseFilenameSet = new Set(object.all_case_filenames);
  for (const vote of object.candidate_votes) {
    for (const example of vote.examples ?? []) {
      if (example.source_filename && example.neighbor_filename) {
        addPair(example.source_filename, example.neighbor_filename, `candidate evidence ${vote.candidate_id}`, vote.candidate_id);
      }
    }
    const caseAnchor = present(object.all_case_filenames)[0];
    const candidateAnchor = present(vote.candidate_filenames).find((filename) => !caseFilenameSet.has(filename));
    if (caseAnchor && candidateAnchor) {
      addPair(caseAnchor, candidateAnchor, `candidate group comparison ${vote.candidate_id}`, vote.candidate_id);
    }
  }

  return pairs;
}

async function runGridOverlayRenderer(manifestPath: string): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    let stderr = "";
    const child = spawn("python3", [gridOverlayScriptPath, "--manifest", manifestPath], {
      cwd: systemRoot,
      stdio: ["ignore", "ignore", "pipe"],
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`grid overlay renderer exited ${code}: ${stderr.trim()}`));
    });
  });
}

async function runAlignmentResidualRenderer(manifestPath: string): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    let stderr = "";
    const child = spawn("python3", [alignmentResidualScriptPath, "--manifest", manifestPath], {
      cwd: systemRoot,
      stdio: ["ignore", "ignore", "pipe"],
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`alignment residual renderer exited ${code}: ${stderr.trim()}`));
    });
  });
}

function alignmentProbeParameterSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["pairs"],
    properties: {
      pairs: {
        type: "array",
        minItems: 1,
        maxItems: maxAlignmentProbePairs,
        description: "Exact filename pairs to inspect more deeply.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["left_filename", "right_filename"],
          properties: {
            left_filename: {
              type: "string",
              minLength: 1,
              description: "Exact filename of the first attached truth or candidate frame.",
            },
            right_filename: {
              type: "string",
              minLength: 1,
              description: "Exact filename of the second attached truth or candidate frame.",
            },
            reason: {
              type: "string",
              description: "Why this pair is decisive, such as suspected rotation, crop shift, or state change.",
            },
            focus_regions: {
              type: "array",
              maxItems: 6,
              description: "Concrete regions or landmarks to inspect, such as door frame, ceiling edge, window trim.",
              items: { type: "string" },
            },
          },
        },
      },
      audit_size: {
        type: "integer",
        minimum: 128,
        maximum: 512,
        description: "Optional analysis size in pixels for the longer side. Default 384.",
      },
      sheet_pairs: {
        type: "integer",
        minimum: 1,
        maximum: maxAlignmentProbePairs,
        description: "Optional number of highest-risk rows to render on the returned sheet. Default equals pair count.",
      },
    },
  };
}

function clampedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function groupMapForObject(object: V3ResidualCaseObject): Map<string, string> {
  const result = new Map<string, string>();
  for (const group of object.truth_groups) {
    for (const filename of group.filenames) result.set(filename, group.group_id);
  }
  return result;
}

function attachmentMapForObject(
  object: V3ResidualCaseObject,
): Map<string, V3ResidualCaseObject["attached_images"][number]> {
  const result = new Map<string, V3ResidualCaseObject["attached_images"][number]>();
  for (const image of object.attached_images) {
    if (!image.exists || !image.filename) continue;
    if (image.role !== "truth_frame" && image.role !== "candidate_frame") continue;
    if (!result.has(image.filename)) result.set(image.filename, image);
  }
  return result;
}

function relationshipForProbePair(
  pair: AlignmentProbeRequestPair,
  leftImage: V3ResidualCaseObject["attached_images"][number],
  rightImage: V3ResidualCaseObject["attached_images"][number],
  groupByFilename: Map<string, string>,
): string {
  const parts: string[] = [];
  if (pair.reason?.trim()) parts.push(pair.reason.trim());

  const focusRegions = (pair.focus_regions ?? [])
    .map((region) => region.trim())
    .filter((region) => region.length > 0)
    .slice(0, 6);
  if (focusRegions.length > 0) parts.push(`focus regions: ${focusRegions.join(", ")}`);

  const leftGroup = groupByFilename.get(pair.left_filename) ?? leftImage.group_ids?.join("+") ?? "unknown";
  const rightGroup = groupByFilename.get(pair.right_filename) ?? rightImage.group_ids?.join("+") ?? "unknown";
  parts.push(`alignment_probe ${leftGroup} / ${rightGroup}`);

  const candidateId = leftImage.candidate_id ?? rightImage.candidate_id;
  if (candidateId) parts.push(`candidate ${candidateId}`);
  return parts.join("; ");
}

function metricNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metricText(value: number | null, digits = 4): string {
  return value === null ? "n/a" : value.toFixed(digits);
}

function probeRisk(metrics: {
  aligned_corr: number | null;
  p99_abs_diff: number | null;
  strong_diff_fraction: number | null;
  edge_delta_fraction: number | null;
}): "high" | "medium" | "low" | "unknown" {
  const p99 = metrics.p99_abs_diff;
  const strong = metrics.strong_diff_fraction;
  const edge = metrics.edge_delta_fraction;
  const corr = metrics.aligned_corr;
  if (p99 === null || strong === null || edge === null || corr === null) return "unknown";
  if (p99 >= 0.28 || strong >= 0.03 || edge >= 0.08 || corr <= 0.985) return "high";
  if (p99 >= 0.18 || strong >= 0.01 || edge >= 0.03 || corr <= 0.995) return "medium";
  return "low";
}

function probeRiskScore(metrics: {
  aligned_corr: number | null;
  p99_abs_diff: number | null;
  strong_diff_fraction: number | null;
  edge_delta_fraction: number | null;
}): number {
  return (
    (metrics.p99_abs_diff ?? 0) +
    (metrics.strong_diff_fraction ?? 0) * 3 +
    (metrics.edge_delta_fraction ?? 0) * 2 +
    (metrics.aligned_corr === null ? 0 : Math.max(0, 1 - metrics.aligned_corr))
  );
}

function probeMetricsFromManifest(rendered: unknown[]): AlignmentProbeMetric[] {
  return rendered
    .map((row, index) => {
      const record = isRecord(row) ? row : {};
      const pair = isRecord(record.pair) ? record.pair : {};
      const analysis = isRecord(record.analysis) ? record.analysis : {};
      const metrics = {
        aligned_corr: metricNumber(analysis.aligned_corr),
        mean_abs_diff: metricNumber(analysis.mean_abs_diff),
        p95_abs_diff: metricNumber(analysis.p95_abs_diff),
        p99_abs_diff: metricNumber(analysis.p99_abs_diff),
        strong_diff_fraction: metricNumber(analysis.strong_diff_fraction),
        edge_delta_fraction: metricNumber(analysis.edge_delta_fraction),
      };
      const risk = probeRisk(metrics);
      return {
        rank: index + 1,
        left_filename: String(pair.left_filename ?? ""),
        right_filename: String(pair.right_filename ?? ""),
        relationship: String(pair.relationship ?? ""),
        risk,
        ...metrics,
        risk_score: probeRiskScore(metrics),
      };
    })
    .sort((left, right) => right.risk_score - left.risk_score)
    .map((metric, index) => ({ ...metric, rank: index + 1 }));
}

function formatAlignmentProbeResult(call: AlignmentProbeCall): string {
  const lines = [
    "alignment_probe completed.",
    `Manifest: ${call.manifest_path}`,
    `Residual sheet: ${call.output_path}`,
    `Rendered pairs: ${call.rendered_pair_count}/${call.requested_pair_count}`,
  ];
  if (call.skipped_pairs.length > 0) {
    lines.push(`Skipped pairs: ${call.skipped_pairs.join(" | ")}`);
  }
  lines.push(
    "Interpretation: high or medium risk is a warning to verify fixed landmarks in the original frames. Smooth exposure-only residuals are not enough to split; shifted edges, crop/framing changes, parallax, or object/state changes are.",
    "Ranked pair metrics:",
  );
  for (const metric of call.metrics) {
    lines.push(
      [
        `${metric.rank}. ${metric.left_filename} vs ${metric.right_filename}`,
        `risk=${metric.risk}`,
        `corr=${metricText(metric.aligned_corr)}`,
        `p99=${metricText(metric.p99_abs_diff)}`,
        `strong=${metricText(metric.strong_diff_fraction)}`,
        `edge=${metricText(metric.edge_delta_fraction)}`,
        `reason=${metric.relationship || "n/a"}`,
      ].join("  "),
    );
  }
  return `${lines.join("\n")}\n`;
}

function createAlignmentProbeTool(params: {
  object: V3ResidualCaseObject;
  outputDir: string;
}): AlignmentProbeToolState {
  const calls: AlignmentProbeCall[] = [];
  let callSequence = 0;
  const filenameToImage = attachmentMapForObject(params.object);
  const groupByFilename = groupMapForObject(params.object);

  const tool: ReviewAgentCustomTool = {
    name: "alignment_probe",
    label: "Alignment Probe",
    description:
      "Render targeted luminance-normalized residual and edge-mismatch evidence for exact filename pairs when grouping depends on tiny alignment, crop, rotation, parallax, ablation, or state differences.",
    promptSnippet:
      "alignment_probe: call this with exact filename pairs when a close grouping decision needs deeper residual and edge-mismatch evidence.",
    promptGuidelines: [
      "Use alignment_probe before the final JSON when a merge, split, or no-change decision hinges on tiny visual differences.",
      "Call alignment_probe with exact filenames and concrete focus regions; keep calls narrow and decision-directed.",
    ],
    parameters: alignmentProbeParameterSchema(),
    executionMode: "sequential",
    execute: async (_toolCallId: string, rawParams: unknown) => {
      const request = isRecord(rawParams) ? (rawParams as unknown as AlignmentProbeParams) : { pairs: [] };
      const requestedPairs = Array.isArray(request.pairs) ? request.pairs.slice(0, maxAlignmentProbePairs) : [];
      const auditSize = clampedInteger(request.audit_size, 384, 128, 512);
      const sheetPairs = clampedInteger(request.sheet_pairs, requestedPairs.length || 1, 1, maxAlignmentProbePairs);

      const residualPairs: AlignmentResidualPair[] = [];
      const skippedPairs: string[] = [];
      const seen = new Set<string>();
      for (const pair of requestedPairs) {
        const leftFilename = String(pair.left_filename ?? "").trim();
        const rightFilename = String(pair.right_filename ?? "").trim();
        const pairLabel = `${leftFilename || "(missing left)"} vs ${rightFilename || "(missing right)"}`;
        if (!leftFilename || !rightFilename || leftFilename === rightFilename) {
          skippedPairs.push(`${pairLabel}: invalid filename pair`);
          continue;
        }
        const key = [leftFilename, rightFilename].sort().join("\0");
        if (seen.has(key)) {
          skippedPairs.push(`${pairLabel}: duplicate request`);
          continue;
        }
        seen.add(key);

        const leftImage = filenameToImage.get(leftFilename);
        const rightImage = filenameToImage.get(rightFilename);
        if (!leftImage || !rightImage) {
          const missing = [
            leftImage ? "" : leftFilename,
            rightImage ? "" : rightFilename,
          ].filter((filename) => filename.length > 0);
          skippedPairs.push(`${pairLabel}: filename not attached (${missing.join(", ")})`);
          continue;
        }

        residualPairs.push({
          left_path: leftImage.source_path,
          right_path: rightImage.source_path,
          left_filename: leftFilename,
          right_filename: rightFilename,
          relationship: relationshipForProbePair(pair, leftImage, rightImage, groupByFilename),
          left_group_id: groupByFilename.get(leftFilename),
          right_group_id: groupByFilename.get(rightFilename),
          candidate_id: leftImage.candidate_id ?? rightImage.candidate_id,
        });
      }

      if (residualPairs.length === 0) {
        const available = [...filenameToImage.keys()].sort();
        return {
          content: [
            {
              type: "text",
              text: [
                "alignment_probe did not render any pairs because none of the requested filename pairs were valid.",
                `Skipped pairs: ${skippedPairs.join(" | ") || "none"}`,
                `Available attached filenames: ${available.join(", ")}`,
              ].join("\n"),
            },
          ],
          details: {
            rendered_pair_count: 0,
            skipped_pairs: skippedPairs,
            available_filenames: available,
          },
        };
      }

      callSequence += 1;
      const callId = `alignment_probe_${String(callSequence).padStart(2, "0")}`;
      const manifestPath = resolve(params.outputDir, `${callId}_manifest.json`);
      const outputPath = resolve(params.outputDir, "alignment_probe_images", `${callId}.jpg`);
      await writeJson(manifestPath, {
        object_id: params.object.object_id,
        residual_type: "tool_alignment_probe",
        audit_size: auditSize,
        sheet_pairs: sheetPairs,
        output_path: outputPath,
        pairs: residualPairs,
      });
      await runAlignmentResidualRenderer(manifestPath);

      const renderedManifest = await readJson<JsonObject>(manifestPath);
      const rendered = Array.isArray(renderedManifest.rendered) ? renderedManifest.rendered : [];
      const metricsWithScores = probeMetricsFromManifest(rendered);
      const metrics = metricsWithScores.map(({ risk_score: _riskScore, ...metric }) => metric);
      const call: AlignmentProbeCall = {
        call_id: callId,
        manifest_path: manifestPath,
        output_path: outputPath,
        requested_pair_count: requestedPairs.length,
        rendered_pair_count: metrics.length,
        skipped_pairs: skippedPairs,
        metrics,
      };
      calls.push(call);

      const content: ReviewAgentToolContent[] = [{ type: "text", text: formatAlignmentProbeResult(call) }];
      const sheetImage = await imageFromPath(outputPath);
      if (sheetImage) content.push(sheetImage.content);
      return {
        content,
        details: call,
      };
    },
  };

  return { tool, calls };
}

async function promptImages(params: {
  object: V3ResidualCaseObject;
  args: Args;
  outputDir: string;
}): Promise<{
  images: PromptImage[];
  overlayManifestPath: string | null;
  overlayImageCount: number;
  alignmentResidualManifestPath: string | null;
  alignmentResidualImageCount: number;
  alignmentResidualPairCount: number;
}> {
  const overlayItems = params.args.gridOverlay
    ? params.object.attached_images
        .map((image, index) => ({ image, index }))
        .filter(({ image }) => shouldApplyGridOverlay(image))
        .map(({ image, index }) => ({
          source_path: image.source_path,
          output_path: imagePathForOverlay(image.source_path, params.outputDir, index, params.args.gridOverlayDir),
          role: image.role,
          filename: image.filename ?? "",
        }))
    : [];

  const overlayManifestPath = overlayItems.length ? resolve(params.outputDir, "grid_overlay_manifest.json") : null;
  const overlayPathBySource = new Map<string, string>();
  if (overlayManifestPath) {
    await writeJson(overlayManifestPath, {
      object_id: params.object.object_id,
      overlay_type: "gray_3x3_alignment_grid",
      items: overlayItems,
    });
    await runGridOverlayRenderer(overlayManifestPath);
    for (const item of overlayItems) overlayPathBySource.set(item.source_path, item.output_path);
  }

  const residualPairs = params.args.alignmentResiduals
    ? buildAlignmentResidualPairs(params.object, params.args.maxAlignmentPairs)
    : [];
  const alignmentResidualManifestPath = residualPairs.length
    ? resolve(params.outputDir, "alignment_residual_manifest.json")
    : null;
  const alignmentResidualOutputPath = residualPairs.length
    ? resolve(params.outputDir, "alignment_residual_images", "alignment_residuals.jpg")
    : null;
  if (alignmentResidualManifestPath && alignmentResidualOutputPath) {
    await writeJson(alignmentResidualManifestPath, {
      object_id: params.object.object_id,
      residual_type: "luminance_aligned_difference_and_edge_mismatch",
      audit_size: 320,
      sheet_pairs: 12,
      output_path: alignmentResidualOutputPath,
      pairs: residualPairs,
    });
    await runAlignmentResidualRenderer(alignmentResidualManifestPath);
  }

  const images = await Promise.all(
    params.object.attached_images.map((image) => imageFromPath(overlayPathBySource.get(image.source_path) ?? image.source_path)),
  );
  const alignmentResidualImage = alignmentResidualOutputPath ? await imageFromPath(alignmentResidualOutputPath) : null;
  return {
    images: [...images.filter((image): image is PromptImage => Boolean(image)), ...(alignmentResidualImage ? [alignmentResidualImage] : [])],
    overlayManifestPath,
    overlayImageCount: overlayItems.length,
    alignmentResidualManifestPath,
    alignmentResidualImageCount: alignmentResidualImage ? 1 : 0,
    alignmentResidualPairCount: residualPairs.length,
  };
}

function userMessageForRun(
  userMessage: string,
  args: Args,
  alignmentResidualPairCount: number,
  alignmentProbeEnabled: boolean,
): string {
  const notes: string[] = [];
  if (args.gridOverlay) {
    notes.push(
      [
        "<visual_alignment_grid>",
        "Attached truth_frame and candidate_frame image bytes include a gray 3x3 alignment grid overlay.",
        "Use the grid lines to compare camera position, yaw/rotation, parallax, horizon/vertical alignment, and framing across similar images.",
        "Ignore the gray grid as scene content. Do not cite it as a real wall, door, object, artifact, blur, or dataset defect.",
        "</visual_alignment_grid>",
      ].join("\n"),
    );
  }
  if (args.alignmentResiduals && alignmentResidualPairCount > 0) {
    notes.push(
      [
        "<visual_alignment_residuals>",
        `One generated alignment residual sheet is appended after the listed image attachments. It was computed from ${alignmentResidualPairCount} selected same-case or candidate comparison pairs.`,
        "Each row shows left image, right image, luminance-normalized residual heatmap, and edge-mismatch heatmap.",
        "Use red/yellow fixed-edge residuals as a warning for tiny viewpoint, rotation, crop/framing, parallax, or material state differences. Smooth exposure/color residuals alone are not enough to split or reject a group.",
        "Treat the residual sheet as an aid: verify any suspected shift against the original attached frames and cite concrete landmarks in the final reasoning.",
        "</visual_alignment_residuals>",
      ].join("\n"),
    );
  }
  if (alignmentProbeEnabled) {
    notes.push(
      [
        "<alignment_probe_tool>",
        "A callable tool named alignment_probe is available before the final JSON.",
        "Use alignment_probe when a grouping decision hinges on tiny viewpoint, rotation, crop/framing, parallax, ablation, fixed-edge, or state differences that are close or ambiguous in the attached images/residual sheet.",
        `Call it with 1-${maxAlignmentProbePairs} exact filenames from the attached truth_frame or candidate_frame images, plus concrete focus_regions such as door frame, ceiling edge, window trim, cabinet line, foreground object, or changed state region.`,
        "The tool returns a targeted residual sheet plus ranked metrics: correlation, p99 luminance residual, strong residual fraction, and edge delta fraction.",
        "After using it, verify the warning against the original frames and cite concrete landmarks in visual_reasoning. Do not use smooth exposure/color residuals alone as evidence for splitting.",
        "Do not call it for obviously different scenes or when the existing evidence already makes the decision clear.",
        "</alignment_probe_tool>",
      ].join("\n"),
    );
  }
  if (notes.length === 0) return userMessage;
  return userMessage.replace(/<\/run>\s*/, `</run>\n\n${notes.join("\n\n")}\n\n`);
}

function extractJsonObject(rawText: string): unknown {
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1] ?? rawText;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Pi response did not contain a JSON object");
  }
  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function reviewGroups(parsed: unknown): JsonObject[] {
  if (!isRecord(parsed)) return [];
  const groupingPlan = parsed.grouping_plan;
  if (!isRecord(groupingPlan) || !Array.isArray(groupingPlan.groups)) return [];
  return groupingPlan.groups.filter(isRecord);
}

function validatePiReview(parsed: unknown, object: V3ResidualCaseObject): string[] {
  const issues: string[] = [];
  if (!isRecord(parsed)) return ["parsed response is not an object"];
  if (parsed.schema_version !== "v3_residual_case_review_0.1") issues.push("schema_version must be v3_residual_case_review_0.1");
  if (parsed.object_id !== object.object_id) issues.push(`object_id must be ${object.object_id}`);

  const decision = isRecord(parsed.decision) ? parsed.decision : {};
  const viewerUpdate = isRecord(parsed.viewer_update) ? parsed.viewer_update : {};
  if (!allowedViewerDecisions.has(String(viewerUpdate.decision ?? ""))) {
    issues.push(`viewer_update.decision is invalid: ${String(viewerUpdate.decision ?? "")}`);
  }

  const groups = reviewGroups(parsed);
  if (groups.length === 0) issues.push("grouping_plan.groups is missing or empty");

  const allowed = new Set(object.all_case_filenames);
  const seen = new Map<string, number>();
  for (const group of groups) {
    const groupId = typeof group.proposed_group_id === "string" ? group.proposed_group_id : "unnamed group";
    const action = typeof group.action === "string" ? group.action : "";
    if (!action) issues.push(`${groupId} is missing action`);
    const members = stringArray(group.member_filenames);
    if (members.length === 0) issues.push(`${groupId} has no member_filenames`);
    for (const filename of members) {
      if (!allowed.has(filename)) issues.push(`${filename} is not in all_case_filenames`);
      seen.set(filename, (seen.get(filename) ?? 0) + 1);
    }
  }

  for (const filename of object.all_case_filenames) {
    const count = seen.get(filename) ?? 0;
    if (count === 0) issues.push(`${filename} is missing from grouping_plan.groups`);
    if (count > 1) issues.push(`${filename} appears in ${count} grouping_plan.groups`);
  }

  const recommendations = Array.isArray(parsed.quality_removal_recommendations) ? parsed.quality_removal_recommendations.filter(isRecord) : [];
  const removedFilenames = new Set(
    groups
      .filter((group) => group.action === "removed_from_dataset")
      .flatMap((group) => stringArray(group.member_filenames)),
  );
  for (const recommendation of recommendations) {
    const filename = typeof recommendation.filename === "string" ? recommendation.filename : "";
    if (!filename) issues.push("quality_removal_recommendations entry is missing filename");
    else if (!allowed.has(filename)) issues.push(`removal recommendation references non-case filename ${filename}`);
    else if (!removedFilenames.has(filename)) issues.push(`${filename} is recommended for removal but not in a removed_from_dataset group`);
  }

  const reviewDecision = typeof decision.review_decision === "string" ? decision.review_decision : "";
  if (reviewDecision === "remove_image_from_dataset" && recommendations.length === 0) {
    issues.push("remove_image_from_dataset decision requires quality_removal_recommendations");
  }
  if (viewerUpdate.decision === "remove_image_from_dataset" && stringArray(viewerUpdate.recommended_removed_filenames).length === 0) {
    issues.push("viewer_update.remove_image_from_dataset requires recommended_removed_filenames");
  }

  return issues;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const path = objectPath(args);
  const object = await readJson<V3ResidualCaseObject>(path);
  const outputDir = resolve(dirname(path), "agent_output");
  await mkdir(outputDir, { recursive: true });

  const systemPromptPath = resolve(dirname(path), "agent_input/system_prompt.md");
  const userMessagePath = resolve(dirname(path), "agent_input/user_message.md");
  const systemPrompt = await readFile(systemPromptPath, "utf8");
  const imageInput = await promptImages({ object, args, outputDir });
  const images = imageInput.images;
  const alignmentProbe = createAlignmentProbeTool({ object, outputDir });
  const userMessage = userMessageForRun(
    await readFile(userMessagePath, "utf8"),
    args,
    imageInput.alignmentResidualPairCount,
    true,
  );

  await atomicWriteFile(resolve(outputDir, "pi_system_prompt.md"), systemPrompt);
  await atomicWriteFile(resolve(outputDir, "pi_user_message.md"), userMessage);

  if (args.dryRun) {
    await writeJson(resolve(outputDir, "dry_run.json"), {
      object_id: object.object_id,
      object_path: path,
      provider: args.provider,
      model: args.model,
      thinking_level: args.thinkingLevel,
      grid_overlay: args.gridOverlay,
      grid_overlay_image_count: imageInput.overlayImageCount,
      grid_overlay_manifest_path: imageInput.overlayManifestPath,
      alignment_residuals: args.alignmentResiduals,
      alignment_residual_image_count: imageInput.alignmentResidualImageCount,
      alignment_residual_pair_count: imageInput.alignmentResidualPairCount,
      alignment_residual_manifest_path: imageInput.alignmentResidualManifestPath,
      custom_tools: [alignmentProbe.tool.name],
      prompt_image_count: images.length,
      attached_image_count: images.length,
      configured_attached_image_count: object.attached_images.length,
      missing_attached_images: object.attached_images.filter((image) => !image.exists).map((image) => image.source_path),
      system_prompt_path: resolve(outputDir, "pi_system_prompt.md"),
      user_message_path: resolve(outputDir, "pi_user_message.md"),
    });
    console.log(`Dry run wrote ${resolve(outputDir, "dry_run.json")}`);
    return;
  }

  const agentConfig: AgentConfig = {
    provider: args.provider,
    model: args.model,
    thinking_level: args.thinkingLevel,
  };
  const result = await runReviewAgent({
    cwd: systemRoot,
    systemPrompt,
    userMessage,
    images,
    agentConfig,
    customTools: [alignmentProbe.tool],
  });

  await atomicWriteFile(resolve(outputDir, "raw_response.txt"), `${result.rawText}\n`);
  await writeJson(resolve(outputDir, "usage.json"), result.usage);
  const parsed = extractJsonObject(result.rawText) as V3ResidualCaseReview;
  const validationIssues = validatePiReview(parsed, object);
  await writeJson(resolve(outputDir, "pi_review.json"), parsed);
  await writeJson(resolve(outputDir, "validation_report.json"), {
    status: validationIssues.length === 0 ? "passed" : "failed",
    issues: validationIssues,
  });
  await writeJson(resolve(outputDir, "run_summary.json"), {
    object_id: object.object_id,
    object_path: path,
    provider: result.provider,
    model: result.model,
    thinking_level: args.thinkingLevel,
    grid_overlay: args.gridOverlay,
    grid_overlay_image_count: imageInput.overlayImageCount,
    grid_overlay_manifest_path: imageInput.overlayManifestPath,
    alignment_residuals: args.alignmentResiduals,
    alignment_residual_image_count: imageInput.alignmentResidualImageCount,
    alignment_residual_pair_count: imageInput.alignmentResidualPairCount,
    alignment_residual_manifest_path: imageInput.alignmentResidualManifestPath,
    custom_tools: [alignmentProbe.tool.name],
    alignment_probe_call_count: alignmentProbe.calls.length,
    alignment_probe_calls: alignmentProbe.calls,
    prompt_image_count: images.length,
    attached_image_count: images.length,
    raw_response_path: resolve(outputDir, "raw_response.txt"),
    pi_review_path: resolve(outputDir, "pi_review.json"),
    validation_report_path: resolve(outputDir, "validation_report.json"),
    validation_issue_count: validationIssues.length,
  });

  console.log(`Pi residual v3 agent completed for ${object.object_id}`);
  console.log(`Validation issues: ${validationIssues.length}`);
  console.log(`Review JSON: ${resolve(outputDir, "pi_review.json")}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
