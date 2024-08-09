### 快速开始

1. 安装依赖

```bash
npm install scrapped-code-webpack-plugin -D
```

2. 在webpack中配置插件

```js
const scrappedCodeWebpackPlugin = require('scrapped-code-webpack-plugin').default;

module.exports = {
  plugins: [
    new scrappedCodeWebpackPlugin({
      // options 配置
    }),
  ],
};
```

3. 参数配置

```ts
export interface Options {
  // 需要校验的文件，可参考fast-glob
  patterns: string[];
  //  需要排除的文件
  exclude: string[];
  // 检测命中时结束进程 默认值false
  failOnHint?: boolean;
  // 控制台打印日志
  log?: false;
  // 是否检测未使用的文件 默认true
  detectUnusedFiles?: boolean;
  // 是否检测未使用的导出 默认true
  detectUnusedExport?: boolean;
  // 导出html, 默认是true
  exportHtml?: boolean | string;
}
```
