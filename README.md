# Wordnest · 拾词

**Collect words. Keep reading.**

在 Chrome 阅读时右键收藏生词，后台查词，之后结合原句复习。

第一版已实现网页收词、本地持久化、真实英英词典查询和复习。界面沿用已经确认的方案 2 与 Animal Island UI；模型解释暂未启用。

源码和安装说明见 [prototype/README.md](prototype/README.md)。

## 从源码安装

需要 Node.js 22+。

```sh
git clone git@github.com:zhaoyanz405/Wordnest.git
cd Wordnest/prototype
npm ci
npm run build:extension
```

在 Chrome 打开 `chrome://extensions`，开启「开发者模式」，点击「加载已解压的扩展程序」，选择刚生成的 `prototype/dist/extension` 目录。

依赖和构建产物不提交到 Git；克隆后先执行上面的安装与构建命令。这仍是早期本地版本，尚未发布到 Chrome 商店。
