//detect scrapped code in webpack project

import { Compilation, Compiler, Chunk } from 'webpack';
import path from 'path';
import chalk from 'chalk';
import fs from 'fs';
import fg from 'fast-glob';

type FileDictionary = Record<string, boolean>;
type ExportDictionary = Record<string, string[]>;

interface Options {
  patterns: string[];
  exclude: string[];
  failOnHint?: boolean;
  context: string;
  log?: false;
  detectUnusedFiles?: boolean;
  detectUnusedExport?: boolean;
  exportHtml?: boolean | string;
  output?: string;
}

class ScrappedCodeWebpackPlugin {
  protected options: Options;

  constructor(options = {}) {
    this.options = {
      patterns: ['**/*.*'],
      exclude: [],
      context: process.cwd(), // 默认上下文为当前工作目录
      failOnHint: false,
      detectUnusedFiles: true,
      detectUnusedExport: true,
      exportHtml: true,
      output: './scrappedCode.html',
      ...options,
    };
  }

  apply(compiler: Compiler) {
    compiler.hooks.afterEmit.tapAsync('ScrappedCodeWebpackPlugin', (compilation, callback) => {
      this.analyzeScrappedCode(compilation, this.options);
      callback();
    });
  }

  analyzeScrappedCode(compilation: Compilation, options: Options) {
    const assets = this.getWebpackResource(compilation);
    // 获取编译后的文件
    const compiledFiles = this.convertFilesToDict(assets as string[]);
    const includedFiles = fg.sync(this.getPattern(options));
    const unusedFiles: string[] = options.detectUnusedFiles ? includedFiles.filter((file) => !compiledFiles[file]) : [];

    const unusedExportMap: ExportDictionary = options.detectUnusedExport
      ? this.getUnusedExportMap(this.convertFilesToDict(includedFiles), compilation)
      : {};
    // 打印日志
    if (options.log) {
      this.logUnusedFiles(unusedFiles);
      this.logUnusedExportMap(unusedExportMap);
    }

    if (options.exportHtml) {
      // 导出html
      this.exportHtml(unusedFiles, unusedExportMap);
    }

    if (unusedFiles.length > 0 || Object.keys(unusedExportMap).length > 0) {
      if (options.failOnHint) {
        process.exit(2);
      }
    }
  }
  // 获取webpackPack资源
  getWebpackResource(compilation: Compilation): string[] {
    // 获取目录下的文件依赖
    const assets = Array.from(compilation.fileDependencies);
    // 路径
    const outputPath: string = compilation.getPath(compilation.compiler.outputPath);
    // 被编译的资源
    compilation.getAssets().forEach((asset) => {
      const assetPath = path.join(outputPath, asset.name);
      assets.push(assetPath);
    });
    return assets;
  }
  // 转换文件为字典
  convertFilesToDict(files: string[]) {
    return files
      .filter((file) => file && file.indexOf('node_modules') === -1)
      .reduce((acc: Record<string, boolean>, file) => {
        const unixFile = this.convertToUnixPath(file);
        acc[unixFile] = true;
        return acc;
      }, {});
  }

  // 转换为unix路径
  private convertToUnixPath(filePath: string) {
    return filePath.replace(/\\+/g, '/');
  }

  private getPattern({ context, patterns, exclude }: Options) {
    return patterns
      .map((pattern) => path.resolve(context, pattern))
      .concat(exclude.map((pattern) => `!${path.resolve(context, pattern)}`))
      .map(this.convertToUnixPath);
  }

  private getUnusedExportMap(includedFileMap: FileDictionary, compilation: Compilation) {
    const unusedExportMap: ExportDictionary = {};
    const isWebpack5 = !!compilation.chunkGraph;
    compilation.chunks.forEach((chunk) => {
      if (isWebpack5) {
        compilation.chunkGraph.getChunkModules(chunk).forEach((module) => {
          this.outputUnusedExportMap(compilation, chunk, module, includedFileMap, unusedExportMap, isWebpack5);
        });
      } else {
        for (const module of chunk.modulesIterable) {
          this.outputUnusedExportMap(compilation, chunk, module, includedFileMap, unusedExportMap, isWebpack5);
        }
      }
    });
    return unusedExportMap;
  }

  private outputUnusedExportMap(
    compilation: Compilation,
    chunk: Chunk,
    module: any,
    includedFileMap: FileDictionary,
    unusedExportMap: ExportDictionary,
    isWebpack5: boolean,
  ) {
    if (!module.resource) return;

    let providedExports;
    if (isWebpack5) {
      providedExports = compilation.chunkGraph.moduleGraph.getProvidedExports(module);
    } else {
      providedExports = module.providedExports || module.buildMeta.providedExports;
    }

    let usedExports;
    if (isWebpack5) {
      usedExports = compilation.chunkGraph.moduleGraph.getUsedExports(module, chunk.runtime);
    } else {
      usedExports = module.usedExports;
    }

    const path = this.convertToUnixPath(module.resource);
    let usedExportsArr: any[] = [];
    // in webpack 4 usedExports can be null | boolean | Array<string>
    // in webpack 5 it can be null | boolean | SortableSet<string>
    if (usedExports instanceof Set) {
      usedExportsArr = Array.from(usedExports);
    } else {
      usedExportsArr = usedExports || [];
    }

    if (
      usedExports !== true &&
      providedExports !== true &&
      /^((?!(node_modules)).)*$/.test(path) &&
      includedFileMap[path]
    ) {
      if (usedExports === false) {
        unusedExportMap[path] = providedExports;
      } else if (providedExports instanceof Array) {
        const unusedExports = providedExports.filter((x) => usedExportsArr && !usedExportsArr.includes(x));

        if (unusedExports.length > 0) {
          unusedExportMap[path] = unusedExports;
        }
      }
    }
  }

  // 日志
  private logUnusedFiles(unusedFiles: string[]) {
    if (!unusedFiles?.length) {
      return;
    }
    console.log(
      chalk.yellow.bold('\nWarning:'),
      chalk.yellow(`There are ${unusedFiles.length} unused files:`),
      ...unusedFiles.map((file, index) => `\n${index + 1}. ${chalk.yellow(file)}`),
      chalk.red.bold('\nPlease be careful if you want to remove them (¬º-°)¬.\n'),
    );
  }
  // 日志
  private logUnusedExportMap(unusedExportMap: ExportDictionary): void {
    if (!Object.keys(unusedExportMap).length) {
      return;
    }
    let numberOfUnusedExport = 0;
    let logStr = '';

    Object.keys(unusedExportMap).forEach((filePath, fileIndex) => {
      const unusedExports = unusedExportMap[filePath];

      logStr += [
        `\n${fileIndex + 1}. `,
        chalk.yellow(`${filePath}\n`),
        '    >>>  ',
        chalk.yellow(`${unusedExports.join(',  ')}`),
      ].join('');

      numberOfUnusedExport += unusedExports.length;
    });
    console.log(
      chalk.yellow.bold('\nWarning:'),
      chalk.yellow(`There are ${numberOfUnusedExport} unused exports in ${Object.keys(unusedExportMap).length} files:`),
      logStr,
      chalk.red.bold('\nPlease be careful if you want to remove them (¬º-°)¬.\n'),
    );
  }

  private exportHtml(unusedFiles: string[], unusedExportMap: ExportDictionary) {
    const html = `
   
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Title</title>
            <style>
        h3 {
          font-weight: 400;
          color: #1f2f3d;
          margin-left: 15px;
        }
        ul {
          list-style: none;
          padding: 0;
        }
        .file li {
          height: 50px;
          line-height: 50px;
          margin: 10px;
          background: #e8f3fe;
          padding: 0 8px;
          color: #7dbcfc;
        }
        .card {
          box-shadow: 0 2px 12px 0 rgba(0, 0, 0, .1);
          border-radius: 4px;
          border: 1px solid #ebeef5;
          margin-bottom: 8px;
        }
        .card__header {
          padding: 18px 20px;
          border-bottom: 1px solid #ebeef5;
          box-sizing: border-box;
        }
        .card__body {
          font-size: 14px;
          padding: 20px;
          border-radius: 4px;
          border: 1px solid #ebeef5;
          overflow: hidden;
          color: #303133;
        }
        .card__body > div {
          margin-bottom: 18px;
        }
      </style>
    </head>
    <body>
    <h3>项目中闲置的文件${unusedFiles.length}</h3>
    <ul class="file">
      ${unusedFiles.map((file, index) => `<li>(${index}): <span>${file}</span></li>`).join('')}
    </ul>
    <h3>项目中导出未使用的代码</h3>
    <ul class="code">
     ${Object.keys(unusedExportMap)
       .map(
         (file) => `<li class="card"><div class="card__header">${file}</div>
          <div class="card__body">
          ${unusedExportMap[file].map((exportName) => `<div>${exportName}</div>`).join('')}
          </div>
        </li>`,
       )
       .join('')}
    </ul>
    </body>
    </html>
    `;
    fs.writeFileSync(path.resolve(process.cwd(), './scrappedCode.html'), html);
  }
}

export default ScrappedCodeWebpackPlugin;
