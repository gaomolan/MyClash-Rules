# Defense rule sources and maintenance

Third-party lists remain attributed to their upstream maintainers. This repository does not claim those entries as original work.

## HaGeZi Native Tracker
- Upstream: <https://github.com/hagezi/dns-blocklists>
- Vivo: <https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/native.vivo.txt>
- Huawei: <https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/native.huawei.txt>
- Upstream repository license: GPL-3.0. Preserve upstream attribution and comply with the license when redistributing modified copies.
- Transformation: extract only strict `||domain^` entries and publish as Mihomo `format: text / behavior: domain`. Syntax or entry-count anomalies stop synchronization.
- Automation: `.github/workflows/sync-native-trackers.yml` refreshes the two official lists daily.

### Local Vivo supplemental entries
- `native-vivo-extra.txt` preserves six entries previously present in this repository but absent from the current upstream list.
- These entries have not been revalidated and remain disabled by default through `屏蔽Vivo历史补充名单`.

## Other sources
| List | Upstream | Purpose / caveat |
|---|---|---|
| AWAvenue | <https://github.com/TG-Twilight/AWAvenue-Ads-Rule> | Ads, privacy and unwanted domains; MRS |
| AdRules | <https://github.com/Cats-Team/AdRules> | China-focused ads, trackers, malware, HTTPDNS and PCDN |
| BanProgramAD | <https://github.com/ACL4SSR/ACL4SSR> | App ads and analytics; upstream notes possible minor side effects; CC-BY-SA-4.0 |
| defense-exceptions.list | Maintained here | Bypasses generic defense lists only, never app-level or port-level blocks |

## Safety constraints
1. App-level blocks run before generic exceptions.
2. Private-network direct rules precede global port blocks to reduce LAN breakage.
3. Generic exceptions cannot bypass SystemHelper process/domain blocks.
4. Vendor Native lists are opt-in per device brand in the generic Go script.
5. A matched network rule does not prove local collection has stopped, nor does it inspect encrypted API payloads or traffic bypassing Mihomo.
