# Resolution System V3 Rule Taxonomy

Resolution v3 reviews residual prediction-vs-truth cases. Its job is not to trust the current truth labels or the prediction output. It decides whether the truth data needs no change, a merge, a split, a move to a candidate group, or a duplicate/policy flag.

V3 Pi review now defaults to x-high reasoning. The strict-capture policy is intentionally sensitive to small visual differences: slight camera offsets, rotations, crop/framing shifts, parallax changes, or visible scene-state/object changes should be split or preserved as separate groups unless the difference is only exposure/color/noise/compression or truly non-material stabilization jitter.

## Primary Decisions

### `algorithm_issue_no_truth_change`

Use this when the current truth group is visually coherent and the prediction is wrong.

Typical signs:

- A normal HDR bracket is split because one exposure is very dark or very bright.
- Stable landmarks stay in the same relative position and scale.
- Candidate groups are only room-type/context matches, not a better same-view target.

Example: `case_bd36dd2bfefa` should stay together. The prediction isolates one exposure from an otherwise coherent bedroom bracket, so this is an algorithm issue.

### `merge_truth_groups_same_capture`

Use this when two or more truth groups should become one strict capture group.

Required evidence:

- Same camera position, angle, zoom, and framing.
- Stable landmarks align: wall corners, door/window openings, cabinet runs, countertop edges, fixtures, ceiling/floor lines, facade edges, horizon, or other fixed geometry.
- Differences are exposure/white balance/noise/compression only, or truly non-material stabilization jitter where fixed landmarks do not shift meaningfully.
- No material scene-state difference.

### `merge_truth_groups_duplicate_or_same_view`

Use this when groups are not a normal exposure bracket but still represent duplicated or repeated same-view data that should be unified or flagged.

Use a duplicate subtype:

- `hard_duplicate`: exact or near-exact image alias.
- `same_view_repeat`: same camera/view, repeated capture with tiny or no differences.
- `repeated_capture`: same viewpoint and scene, separate bracket/capture event.
- `possible_duplicate`: duplicate-like but not enough certainty for an automatic merge.

Example: `case_09e6be1c60f3` looks like commercial bathroom brackets duplicated under different groups. Treat it as same-view/duplicate ambiguity unless the agent finds a material difference.

### `split_truth_group_viewpoint_change`

Use this when a current truth group contains multiple camera viewpoints.

Split triggers:

- Camera moved left/right/forward/back, changed height, changed focal length, or materially rotated.
- Same room/property remains visible but fixed geometry shifts, even subtly, across walls, doors, windows, cabinets, counters, ceiling/floor lines, horizon, or foreground/background parallax.
- Slight offset, slight rotation, crop/framing change, or yaw change that moves fixed landmarks should be a separate strict group.
- Drone/exterior frames show different angles, flight positions, or perspective on the same subject.

Example: `case_57a79dae0723` is a drone/aerial case. Different drone angles should be split, even if they show the same site.

### `split_truth_group_state_change`

Use this when camera position is close but visible scene state changes materially.

Material state changes include:

- Door open vs closed.
- Window, blind, curtain, gate, awning, cover, or umbrella state changed.
- Towels, furniture, vehicles, objects, lights, water/fire features, or appliances added, removed, moved, on, or off.

Door-open versus door-closed groups should stay separated unless the state change is not visible enough to affect training.

### `split_truth_group_multi_scene`

Use this when one truth group contains clearly different rooms, areas, or scenes.

Examples:

- Bathroom plus hallway.
- Kitchen plus bedroom.
- Same property but different exterior locations.

### `move_component_to_candidate_group`

Use this when the residual component belongs with a candidate group outside the current truth groups.

Required evidence:

- Candidate group shows the same strict capture or clearly better same-view bracket.
- The move is stronger than simply merging/splitting the current truth groups.
- The candidate is not only a room-type or semantic match.

### `remove_image_from_dataset`

Use this sparingly when an individual image is not useful for training and should be removed rather than regrouped.

Allowed reasons:

- Severe blur or motion smear that destroys stable landmarks.
- Corrupt, blank, placeholder, or near-empty image.
- Severe overexposure/underexposure where the frame has too little recoverable structure.
- Low-information frame that cannot support same-capture learning and is not valuable context.

Do not use this for normal HDR exposure endpoints, moderate blur, aesthetic weakness, or merely difficult images. If a frame is very bright/dark but still contains stable geometry and belongs to the bracket, keep it grouped and mark the case as an algorithm issue.

Example: in `case_a6cf82b65549`, `g54845_DSC02485.jpg` may be recommended for removal if visual review confirms it is severely blurry and worthless. This should be a rare exception, not the default response to hard exposures.

### `needs_human_policy_review`

Use this when the visual evidence is strong enough to flag a problem but policy is ambiguous.

Typical cases:

- Same room, same camera position, but uncertain whether it is a repeated capture that should be active or excluded.
- Near-duplicate single images that are not a normal bracket.
- Same room with a suspected slight offset/rotation/state change where it is unclear whether fixed landmarks or state actually changed.

Example: `case_d6745ea98397` should be reviewed for whether the two bedroom brackets are the same room and same camera position. If slight offset/rotation/parallax shifts fixed landmarks, keep separate; merge only if it is exposure/color/noise or non-material stabilization jitter.

### `insufficient_evidence`

Use this when the images, sheets, or candidate evidence are missing or too ambiguous to choose a correction.

## Strict Capture Rules

Strict capture positives are only for images that should train as the same capture/view.

Allow:

- Exposure variation in an HDR bracket.
- Truly non-material stabilization jitter where fixed landmarks do not shift meaningfully.
- Minor crop/compression/noise/color differences.

Do not allow:

- Different camera position, including slight offset that changes landmark alignment.
- Visible rotation/yaw that changes perspective or landmark placement.
- Crop/framing shifts that change the usable capture view.
- Different zoom/focal length.
- Same room or property from a different angle.
- Drone frames from different flight positions.
- Material scene-state or object changes, including door/window/blind state, towels, movable objects, lighting, appliance, water/fire feature, or vehicle changes.

## Duplicate Rules

The residual audit was built from a deduplicated/resolved manifest, so duplicate-looking cases should not be assumed to be raw hard duplicates. They may be:

- True hard duplicate misses that escaped the prior scan.
- Same-view repeated captures.
- Repeated HDR brackets from the same camera position.
- Legitimate separate captures that look similar.

The v3 agent should flag duplicates separately from the truth action. A case can be `algorithm_issue_no_truth_change` and still have no duplicate flag, or it can be `merge_truth_groups_duplicate_or_same_view` with a duplicate subtype.

## Decision Mapping To Viewer

- `algorithm_issue_no_truth_change` -> viewer `algorithm_issue`
- `merge_truth_groups_same_capture` -> viewer `merge_truth_groups`
- `merge_truth_groups_duplicate_or_same_view` -> viewer `merge_truth_groups` plus duplicate flag
- `split_truth_group_viewpoint_change` -> viewer `split_truth_group`
- `split_truth_group_state_change` -> viewer `split_truth_group`
- `split_truth_group_multi_scene` -> viewer `split_truth_group`
- `move_component_to_candidate_group` -> viewer `move_to_candidate_group`
- `remove_image_from_dataset` -> viewer `remove_image_from_dataset`
- `needs_human_policy_review` -> viewer `needs_more_review`
- `insufficient_evidence` -> viewer `insufficient_evidence`
