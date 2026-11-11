import { cp, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
await cp(
  root + "extension/manifest.json",
  root + "dist/extension/manifest.json",
);
await cp(root + "extension/icons", root + "dist/extension/icons", {
  recursive: true,
});
await cp(
  root + "THIRD-PARTY-NOTICES.txt",
  root + "dist/extension/THIRD-PARTY-NOTICES.txt",
);
await writeFile(
  root + "dist/extension/INSTALL.txt",
  "在 Chrome 打开 chrome://extensions，开启开发者模式，点击“加载已解压的扩展程序”，选择这个目录。\n本地 PDF 需要在扩展详情中允许访问文件网址。\n词典优先；当前提供英英释义，AI 尚未启用。\n",
);
const manifest = JSON.parse(
  await readFile(root + "dist/extension/manifest.json", "utf8"),
);
console.log(`已准备 ${manifest.name} ${manifest.version}：dist/extension`);
