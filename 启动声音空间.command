#!/bin/zsh
cd -- "${0:A:h}" || exit 1
node_bin="$(command -v node 2>/dev/null)"
if [[ -z "$node_bin" ]]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [[ -x "$candidate" ]]; then node_bin="$candidate"; break; fi
  done
fi
if [[ -z "$node_bin" ]]; then
  print '未找到 Node.js 请安装 Node.js 22 或更新版本后再次双击'
  read '?按回车关闭此窗口 '
  exit 1
fi
"$node_bin" scripts/launch.mjs
result=$?
if (( result != 0 )); then read '?按回车关闭此窗口 '; fi
exit $result
