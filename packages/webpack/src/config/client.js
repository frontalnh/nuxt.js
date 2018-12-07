import path from 'path'
import webpack from 'webpack'
import HTMLPlugin from 'html-webpack-plugin'
import BundleAnalyzer from 'webpack-bundle-analyzer'
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin'
import FriendlyErrorsWebpackPlugin from '@nuxt/friendly-errors-webpack-plugin'

import CorsPlugin from '../plugins/vue/cors'
import ModernModePlugin from '../plugins/vue/modern'
import VueSSRClientPlugin from '../plugins/vue/client'
import WebpackBaseConfig from './base'

export default class WebpackClientConfig extends WebpackBaseConfig {
  constructor(builder, options) {
    super(builder, options || { name: 'client', isServer: false })
  }

  getFileName(...args) {
    if (this.options.build.analyze) {
      const key = args[0]
      if (['app', 'chunk'].includes(key)) {
        return `${this.isModern ? 'modern-' : ''}[name].js`
      }
    }
    return super.getFileName(...args)
  }

  env() {
    return Object.assign(super.env(), {
      'process.env.VUE_ENV': JSON.stringify('client'),
      'process.browser': true,
      'process.client': true,
      'process.server': false
    })
  }

  optimization() {
    const optimization = super.optimization()

    // Small, known and common modules which are usually used project-wise
    // Sum of them may not be more than 244 KiB
    if (
      this.options.build.splitChunks.commons === true &&
      optimization.splitChunks.cacheGroups.commons === undefined
    ) {
      optimization.splitChunks.cacheGroups.commons = {
        test: /node_modules[\\/](vue|vue-loader|vue-router|vuex|vue-meta|core-js|@babel\/runtime|axios|webpack|setimmediate|timers-browserify|process|regenerator-runtime|cookie|js-cookie|is-buffer|dotprop|nuxt\.js)[\\/]/,
        chunks: 'all',
        priority: 10,
        name: true
      }
    }

    return optimization
  }

  minimizer() {
    const minimizer = super.minimizer()

    // https://github.com/NMFR/optimize-css-assets-webpack-plugin
    // https://github.com/webpack-contrib/mini-css-extract-plugin#minimizing-for-production
    // TODO: Remove OptimizeCSSAssetsPlugin when upgrading to webpack 5
    if (this.options.build.optimizeCSS) {
      minimizer.push(
        new OptimizeCSSAssetsPlugin(Object.assign({}, this.options.build.optimizeCSS))
      )
    }

    return minimizer
  }

  plugins() {
    const plugins = super.plugins()

    // Generate output HTML for SSR
    if (this.options.build.ssr) {
      plugins.push(
        new HTMLPlugin({
          filename: '../server/index.ssr.html',
          template: this.options.appTemplatePath,
          minify: this.options.build.html.minify,
          inject: false // Resources will be injected using bundleRenderer
        })
      )
    }

    plugins.push(
      new HTMLPlugin({
        filename: '../server/index.spa.html',
        template: this.options.appTemplatePath,
        minify: this.options.build.html.minify,
        inject: true,
        chunksSortMode: 'dependency'
      }),
      new VueSSRClientPlugin({
        filename: `../server/${this.name}.manifest.json`
      }),
      new webpack.DefinePlugin(this.env())
    )

    if (this.options.dev) {
      // TODO: webpackHotUpdate is not defined: https://github.com/webpack/webpack/issues/6693
      plugins.push(new webpack.HotModuleReplacementPlugin())
    }

    // Webpack Bundle Analyzer
    // https://github.com/webpack-contrib/webpack-bundle-analyzer
    if (!this.options.dev && this.options.build.analyze) {
      const statsDir = path.resolve(this.options.buildDir, 'stats')

      plugins.push(new BundleAnalyzer.BundleAnalyzerPlugin(Object.assign({
        analyzerMode: 'static',
        defaultSizes: 'gzip',
        generateStatsFile: true,
        openAnalyzer: !this.options.build.quiet,
        reportFilename: path.resolve(statsDir, `${this.name}.html`),
        statsFilename: path.resolve(statsDir, `${this.name}.json`)
      }, this.options.build.analyze)))
    }

    if (this.options.modern) {
      plugins.push(new ModernModePlugin({
        targetDir: path.resolve(this.options.buildDir, 'dist', 'client'),
        isModernBuild: this.isModern
      }))
    }

    if (this.options.build.crossorigin) {
      plugins.push(new CorsPlugin({
        crossorigin: this.options.build.crossorigin
      }))
    }

    return plugins
  }

  config() {
    const config = super.config()

    // Entry points
    config.entry = {
      app: [path.resolve(this.options.buildDir, 'client.js')]
    }

    // Add HMR support
    if (this.options.dev) {
      config.entry.app.unshift(
        // https://github.com/glenjamin/webpack-hot-middleware#config
        `webpack-hot-middleware/client?name=${this.name}&reload=true&timeout=30000&path=${
          this.options.router.base
        }/__webpack_hmr/${this.name}`.replace(/\/\//g, '/')
      )
    }

    // Add friendly error plugin
    if (this.options.dev && !this.options.build.quiet && !this.options.build.friendlyErrorsPlugin) {
      config.plugins.push(
        new FriendlyErrorsWebpackPlugin({
          clearConsole: false,
          reporter: 'consola',
          logLevel: 'WARNING'
        })
      )
    }

    return config
  }
}
