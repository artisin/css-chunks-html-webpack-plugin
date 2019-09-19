// Safe optional dep - https://github.com/tallesl/node-safe-require
const HtmlWebpackPlugin = require('safe-require')('html-webpack-plugin');

// Plugin Constants
const PLUGIN_NAME = 'CssChunksHtmlWebpackPlugin';
const PLUGIN_HTML_HOOK = 'html-webpack-plugin-before-html-generation';
const PLUGIN_ASSET_HOOK = 'html-webpack-plugin-alter-asset-tags';


class CssChunkHashPlugin {
  constructor(options) {
    this.options = Object.assign(
      {
        inject: 'head',
      },
      options
    );
  }

  createCssHash(chunks, publicPath) {
    return chunks.reduce((hash, { name, files }) => {
      if (!Array.isArray(files)) return hash;
      const file = files.find(file => file.includes('.css') && !file.includes('.css.map'));
      if (file) hash[name] = `${publicPath}${file}`;
      return hash;
    }, {});
  }

  getScriptTag(cssHash) {
    return {
      tagName: 'script',
      closeTag: true,
      attributes: {
        type: 'text/javascript',
      },
      innerHTML: `window.__CSS_CHUNKS__ = ${JSON.stringify(cssHash)}`,
    };
  }

  apply(compiler) {
    compiler.hooks.compilation.tap(PLUGIN_NAME, compilation => {
      let cssHash;
      const inject = this.options.inject;

      // Html CSS hashmap hook
      const cssChunksBeforeHtmlProcessingFn = (htmlPluginData, callback) => {
        cssHash = this.createCssHash(compilation.chunks, compilation.outputOptions.publicPath);
        htmlPluginData.assets.cssHash = cssHash;
        callback(null, htmlPluginData);
      };

      // Asset (script) Tag hook "window.__CSS_CHUNKS__"
      const cssChunksAssetTagsFn = (isPluginV4 = true) => (htmlPluginData, callback) => {
        const tag = this.getScriptTag(cssHash);
        const pushInto = inject === 'head'
          ? (isPluginV4 ? 'headTags' : 'head')
          : (isPluginV4 ? 'bodyTags' : 'body');
        htmlPluginData[pushInto].push(tag);
        callback(null, htmlPluginData);
      };

      // HtmlWebPackPlugin 4.x
      if (HtmlWebpackPlugin && !!HtmlWebpackPlugin.getHooks) {
        // Static Hooks helper
        // @docs: github.com/jantimon/html-webpack-plugin#events
        const hooks = HtmlWebpackPlugin.getHooks(compilation);
        // Before Html Processing
        hooks.beforeAssetTagGeneration.tapAsync(
          PLUGIN_HTML_HOOK,
          cssChunksBeforeHtmlProcessingFn
        );
        // Asset alter tags
        if (inject) {
          hooks.alterAssetTagGroups.tapAsync(
            PLUGIN_ASSET_HOOK,
            cssChunksAssetTagsFn(true)
          );
        }
      }else {
        // HtmlWebPackPlugin 3.x Hooks
        // Before Html Processing
        compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing.tapAsync(
          PLUGIN_HTML_HOOK,
          cssChunksBeforeHtmlProcessingFn
        );
        // Asset alter tags
        if (inject) {
          compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(
            PLUGIN_ASSET_HOOK,
            cssChunksAssetTagsFn(false)
          );
        }
      }
    });
  }
}

module.exports = CssChunkHashPlugin;
