#!/usr/bin/env bash
set -euo pipefail

readonly BASE_URL="https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard"
readonly TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# vendor|minimum_expected_entries
readonly SOURCES=(
  "vivo|150"
  "huawei|80"
  "amazon|200"
  "apple|50"
  "samsung|100"
  "tiktok|200"
  "lgwebos|100"
  "roku|20"
  "oppo-realme|200"
  "xiaomi|150"
  "winoffice|150"
)

for entry in "${SOURCES[@]}"; do
  vendor="${entry%%|*}"
  minimum="${entry##*|}"
  filename="native-${vendor}.txt"
  destination="ruleset/${filename}"
  temporary="${TMP_DIR}/${filename}"
  source_url="${BASE_URL}/native.${vendor}-onlydomains.txt"

  echo "::group::Validate HaGeZi Native Tracker: ${vendor}"
  curl --fail --location --silent --show-error --retry 3 --retry-delay 2 \
    --connect-timeout 15 --max-time 90 "${source_url}" -o "${temporary}"

  grep -q "^# Title: HaGeZi's .* Tracker" "${temporary}"
  grep -q "^# License: https://github.com/hagezi/dns-blocklists/blob/main/LICENSE" "${temporary}"
  grep -q "^# Syntax: Domains (without subdomains)$" "${temporary}"

  declared="$(sed -n 's/^# Number of entries: *\([0-9][0-9]*\).*$/\1/p' "${temporary}" | head -n 1)"
  actual="$(grep -vE '^(#|[[:space:]]*$)' "${temporary}" | wc -l | tr -d ' ')"

  test -n "${declared}"
  test "${declared}" -ge "${minimum}"
  test "${declared}" -eq "${actual}"

  # 只接受纯域名行，避免把异常格式/错误页面发布成可用规则集。
  if grep -vE '^(#|[[:space:]]*$|[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+)$' "${temporary}"; then
    echo "::error::Invalid domain line in ${filename}"
    exit 1
  fi

  # 防止上游异常截断或错误合并导致名单规模骤变；需要人工审查后再更新阈值。
  if [[ -f "${destination}" ]]; then
    previous="$(grep -vE '^(#|[[:space:]]*$)' "${destination}" | wc -l | tr -d ' ')"
    if (( declared * 2 < previous || declared > previous * 2 )); then
      echo "::error::Unexpected entry-count swing for ${vendor}: ${previous} -> ${declared}"
      exit 1
    fi
  fi

  install -m 0644 "${temporary}" "${destination}"
  echo "${vendor}: ${actual} domains; upstream metadata validated"
  echo "::endgroup::"
done
