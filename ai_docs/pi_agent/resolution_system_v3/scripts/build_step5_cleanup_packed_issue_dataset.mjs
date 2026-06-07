#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const systemRoot = resolve(scriptDir, "..");
const repoRoot = resolve(systemRoot, "..");
const dataRoot = resolve(repoRoot, "../data");
const defaultOutputDir = resolve(dataRoot, "v7_issue_review", "v7_step5_cleanup_not_reflected_20260603");
const defaultFinalManifest = resolve(dataRoot, "manifests", "full_public_manifest_1024_q90_cleaned_pi_v2_auto_v3_reviewed_round4_hard.csv");

function usage() {
  return [
    "Usage:",
    "  node scripts/build_step5_cleanup_packed_issue_dataset.mjs [--output-dir <path>] [--final-manifest <path>]",
    "",
    "Builds a packed-issue style review queue from Step 5 cleanup not-reflected edits.",
  ].join("\n");
}

function resolveFromRepo(pathValue) {
  return isAbsolute(pathValue) ? pathValue : resolve(repoRoot, pathValue);
}

function parseArgs(argv) {
  const args = {
    outputDir: defaultOutputDir,
    finalManifest: defaultFinalManifest,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };
    if (arg === "--output-dir") args.outputDir = resolveFromRepo(next());
    else if (arg === "--final-manifest") args.finalManifest = resolveFromRepo(next());
    else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }
  return args;
}

function uniqueInOrder(values) {
  const seen = new Set();
  const result = [];
  for (const value of values ?? []) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function sortedKey(values) {
  return uniqueInOrder(values).slice().sort().join("\n");
}

const roundOrder = new Map([
  ["round1", 1],
  ["round2", 2],
  ["round3_singleton", 3],
  ["round4", 4],
  ["round4_hard", 5],
]);

function step5ItemFilenameKey(item) {
  return sortedKey([
    ...(item.actual_groups ?? []).flatMap((group) => group.member_filenames ?? group.filenames ?? []),
    ...(item.expected_filenames ?? []),
    ...(item.removed_filenames ?? []),
  ]);
}

function newerStep5ItemFirst(left, right) {
  return (
    (roundOrder.get(right.round_key) ?? 0) - (roundOrder.get(left.round_key) ?? 0) ||
    (right.rank ?? 0) - (left.rank ?? 0) ||
    String(right.id ?? "").localeCompare(String(left.id ?? ""))
  );
}

function dedupeSourceItems(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = step5ItemFilenameKey(item) || item.id;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(item);
  }

  const deduped = [];
  const duplicateGroups = [];
  for (const [key, groupItems] of byKey.entries()) {
    const ordered = groupItems.slice().sort(newerStep5ItemFirst);
    const kept = {
      ...ordered[0],
      dedupe_key: key,
      dedupe_duplicate_count: ordered.length - 1,
      dedupe_suppressed_items: ordered.slice(1).map((item) => ({
        id: item.id,
        round_key: item.round_key,
        round_label: item.round_label,
        issue_id: item.issue_id,
        operation: item.operation,
        human_decision: item.human_decision,
        pi_review_decision: item.pi_review_decision,
        pi_confidence: item.pi_confidence,
        materialization_status: item.materialization_status,
        materialization_reason: item.materialization_reason,
      })),
    };
    deduped.push(kept);
    if (ordered.length > 1) {
      duplicateGroups.push({
        key,
        kept: kept.id,
        suppressed: kept.dedupe_suppressed_items,
      });
    }
  }
  deduped.sort((left, right) => (left.rank ?? 0) - (right.rank ?? 0) || String(left.id).localeCompare(String(right.id)));
  return { deduped, duplicateGroups };
}

function safeIssueId(value) {
  return String(value ?? "")
    .replaceAll(/[\\/]/g, "_")
    .replaceAll(/\s+/g, "_")
    .slice(0, 220);
}

function priorGroupingText(groups = []) {
  return groups
    .filter((group) => (group.member_filenames ?? []).length)
    .map((group, index) => `Group ${index + 1} (${group.label ?? group.group_id ?? `Group ${index + 1}`}): ${(group.member_filenames ?? []).join(", ")}`)
    .join("\n");
}

function actualTruthGroups(item) {
  return (item.actual_groups ?? [])
    .map((group, index) => {
      const filenames = uniqueInOrder(group.member_filenames ?? group.filenames ?? []);
      return {
        group_id: group.group_id ?? `current_final_group_${String(index + 1).padStart(3, "0")}`,
        member_count: filenames.length,
        filenames,
      };
    })
    .filter((group) => group.filenames.length);
}

function expectedPredictionParts(item, truthGroups) {
  const truthGroupIdsByFilename = new Map();
  for (const group of truthGroups) {
    for (const filename of group.filenames) {
      if (!truthGroupIdsByFilename.has(filename)) truthGroupIdsByFilename.set(filename, []);
      truthGroupIdsByFilename.get(filename).push(group.group_id);
    }
  }
  return (item.expected_groups ?? [])
    .map((group, index) => {
      const filenames = uniqueInOrder(group.member_filenames ?? group.filenames ?? []);
      return {
        prediction_group_id: `prior_expected_${String(index + 1).padStart(3, "0")}`,
        group_id: group.group_id ?? `prior_expected_${String(index + 1).padStart(3, "0")}`,
        label: group.label ?? group.group_id ?? `Prior expected ${index + 1}`,
        member_count: filenames.length,
        filenames,
        truth_group_ids: uniqueInOrder(filenames.flatMap((filename) => truthGroupIdsByFilename.get(filename) ?? [])),
      };
    })
    .filter((group) => group.filenames.length);
}

function issueType(item, truthGroups, predictionParts) {
  if (item.operation === "remove_image") return "mixed";
  const truthGroupIdByFilename = new Map();
  for (const group of truthGroups) {
    for (const filename of group.filenames) truthGroupIdByFilename.set(filename, group.group_id);
  }
  const expectedGroupIdsByTruth = new Map();
  for (const part of predictionParts) {
    for (const filename of part.filenames) {
      const truthGroupId = truthGroupIdByFilename.get(filename);
      if (!truthGroupId) continue;
      if (!expectedGroupIdsByTruth.has(truthGroupId)) expectedGroupIdsByTruth.set(truthGroupId, new Set());
      expectedGroupIdsByTruth.get(truthGroupId).add(part.prediction_group_id);
    }
  }
  const hasMerge = predictionParts.some((part) => (part.truth_group_ids ?? []).length > 1) || predictionParts.length < truthGroups.length;
  const hasSplit = [...expectedGroupIdsByTruth.values()].some((ids) => ids.size > 1) || predictionParts.length > truthGroups.length;
  if (hasMerge && hasSplit) return "mixed";
  if (hasMerge) return "false_merge";
  if (hasSplit) return "false_split";
  return item.operation === "merge" ? "false_merge" : item.operation === "split" ? "false_split" : "mixed";
}

function buildIssueRow(item, index) {
  const truthGroups = actualTruthGroups(item);
  const predictionParts = expectedPredictionParts(item, truthGroups);
  const type = issueType(item, truthGroups, predictionParts);
  const allFilenames = uniqueInOrder([
    ...truthGroups.flatMap((group) => group.filenames),
    ...predictionParts.flatMap((group) => group.filenames),
    ...(item.removed_filenames ?? []),
  ]);
  const issueId = safeIssueId(`step5_${item.round_key}_${item.issue_id}`);
  return {
    all_filenames: allFilenames,
    evidence: [
      {
        source: "v7_step5_cleanup_not_reflected",
        source_round_key: item.round_key,
        source_round_label: item.round_label,
        source_issue_id: item.issue_id,
        source_operation: item.operation,
        reflection_status: item.reflection_status,
        cleanup_status: item.cleanup_status,
        materialization_status: item.materialization_status,
        materialization_reason: item.materialization_reason,
        prior_human_decision: item.human_decision,
        prior_human_notes: item.human_notes,
        prior_pi_review_decision: item.pi_review_decision,
        prior_pi_confidence: item.pi_confidence,
        expected_groups: (item.expected_groups ?? []).map((group) => ({
          group_id: group.group_id,
          label: group.label,
          action: group.action,
          member_filenames: group.member_filenames ?? [],
        })),
        current_final_manifest_groups: truthGroups,
        removed_filenames: item.removed_filenames ?? [],
        removed_still_present: item.removed_still_present ?? [],
        missing_filenames: item.missing_filenames ?? [],
        dedupe_duplicate_count: item.dedupe_duplicate_count ?? 0,
        dedupe_suppressed_items: item.dedupe_suppressed_items ?? [],
        note:
          "Current truth groups come from the latest Round Four Hard manifest. Prediction parts are the previously accepted expected grouping that is not exactly reflected in that final manifest.",
      },
    ],
    filename_count: allFilenames.length,
    has_merge: type === "false_merge" || type === "mixed",
    has_split: type === "false_split" || type === "mixed",
    issue_id: issueId,
    issue_key: `${item.round_key}|${item.issue_id}`,
    issue_type: type,
    occurrence_count: 1 + (item.dedupe_duplicate_count ?? 0),
    original_issue_id: item.issue_id,
    original_round_key: item.round_key,
    prediction_group_ids: predictionParts.map((group) => group.prediction_group_id),
    prediction_part_count: predictionParts.length,
    prediction_parts: predictionParts,
    rank: index + 1,
    source_step5_item_id: item.id,
    truth_group_count: truthGroups.length,
    truth_group_ids: truthGroups.map((group) => group.group_id),
    truth_groups: truthGroups,
  };
}

function priorDecisionFor(item, issueRow) {
  const priorDecision = item.human_decision && item.human_decision !== "unreviewed"
    ? item.human_decision
    : item.operation === "no_change"
      ? "no_change"
      : "propose_grouping";
  const notes = [
    `Prior ${item.round_label} decision for ${item.issue_id}.`,
    item.dedupe_duplicate_count ? `Deduped ${item.dedupe_duplicate_count} older not-reflected source row(s) for the same filename set.` : "",
    item.human_notes ? `Notes: ${item.human_notes}` : "",
    item.materialization_reason ? `Materialization: ${item.materialization_reason}` : "",
  ].filter(Boolean).join(" ");
  return {
    review_tag: "v7_step5_cleanup_prior_review",
    issue_id: issueRow.issue_id,
    source_issue_id: item.issue_id,
    source_round_key: item.round_key,
    pi_review_decision: item.pi_review_decision ?? "",
    pi_confidence: item.pi_confidence ?? "",
    issue_type: issueRow.issue_type,
    decision: priorDecision,
    notes,
    proposed_grouping_text: priorGroupingText(item.expected_groups ?? []),
    updated_at: item.human_reviewed_at ?? null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  process.env.VIEWER_SERVER_NO_LISTEN = "1";
  process.env.V7_STEP5_CLEANUP_FINAL_MANIFEST = args.finalManifest;
  const { loadV7Step5Cleanup } = await import("../../viewer/server.mjs");
  const data = await loadV7Step5Cleanup();
  const rawSourceItems = data.items.filter((item) => item.reflection_status === "not_reflected");
  const { deduped: sourceItems, duplicateGroups } = dedupeSourceItems(rawSourceItems);
  const issues = sourceItems.map(buildIssueRow);
  const priorDecisions = {};
  for (let index = 0; index < sourceItems.length; index += 1) {
    priorDecisions[issues[index].issue_id] = priorDecisionFor(sourceItems[index], issues[index]);
  }

  const issueTypeCounts = issues.reduce((acc, issue) => {
    acc[issue.issue_type] = (acc[issue.issue_type] ?? 0) + 1;
    return acc;
  }, {});
  const truthGroupIds = new Set(issues.flatMap((issue) => issue.truth_group_ids));
  const filenames = new Set(issues.flatMap((issue) => issue.all_filenames));
  const summary = {
    filename_count: filenames.size,
    issue_count: issues.length,
    issue_type_counts: issueTypeCounts,
    mode: "v7_step5_cleanup_not_reflected",
    paths: {
      issues_jsonl: resolve(args.outputDir, "issues.jsonl"),
      summary: resolve(args.outputDir, "summary.json"),
      prior_manual_review: resolve(args.outputDir, "prior_manual_review.decisions.json"),
    },
    raw_issue_count: issues.length,
    raw_step5_not_reflected_count: rawSourceItems.length,
    deduped_issue_count: issues.length,
    deduped_duplicate_group_count: duplicateGroups.length,
    deduped_suppressed_issue_count: rawSourceItems.length - issues.length,
    deduped_duplicate_groups: duplicateGroups,
    run_count: 1,
    source_manifest: args.finalManifest,
    truth_group_count: truthGroupIds.size,
    source: {
      step5_summary: data.summary,
      note:
        "This queue contains only Step 5 cleanup edits whose prior materialized grouping is not exactly reflected in the latest Round Four Hard manifest.",
    },
  };
  const priorReview = {
    review_tag: "v7_step5_cleanup_prior_review",
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: {
      final_manifest: args.finalManifest,
      step5_not_reflected_count: rawSourceItems.length,
      deduped_issue_count: issues.length,
      deduped_suppressed_issue_count: rawSourceItems.length - issues.length,
    },
    decisions: priorDecisions,
  };

  await mkdir(args.outputDir, { recursive: true });
  await writeFile(resolve(args.outputDir, "issues.jsonl"), `${issues.map((issue) => JSON.stringify(issue)).join("\n")}\n`, "utf8");
  await writeFile(resolve(args.outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(resolve(args.outputDir, "prior_manual_review.decisions.json"), `${JSON.stringify(priorReview, null, 2)}\n`, "utf8");
  console.log(`Built ${issues.length} Step 5 cleanup packed issues in ${args.outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
