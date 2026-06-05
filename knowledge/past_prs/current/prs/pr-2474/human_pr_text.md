## PR #2474: fix: the custom strcpy(char *dst, char *src) and str... in...
Author: orbisai0security
URL: https://github.com/doldecomp/melee/pull/2474

## Summary
Fix critical severity security issue in `extern/dolphin/include/charPipeline/structures/dolphinString.h`.

## Vulnerability
| Field | Value |
|-------|-------|
| **ID** | V-001 |
| **Severity** | CRITICAL |
| **Scanner** | multi_agent_ai |
| **Rule** | `V-001` |
| **File** | `extern/dolphin/include/charPipeline/structures/dolphinString.h:10` |

**Description**: The custom Strcpy(char *dst, char *src) and Strcat(char *str1, char *str2, char *dst) functions declared in dolphinString.h perform string copies without any bounds checking or destination buffer size parameter. Any call site that passes a source string longer than the destination buffer will overflow the buffer, corrupting adjacent stack frames or heap metadata. Because these functions accept no size limit, there is no safe way to call them with untrusted input.

## Changes
- `extern/dolphin/include/charPipeline/structures/dolphinString.h`

## Verification
- [x] Build passes
- [x] Scanner re-scan confirms fix
- [x] LLM code review passed

---
*Automated security fix by [OrbisAI Security](https://orbisappsec.com)*
