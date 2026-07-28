/**
 * HubForge Browser SDK
 * 嵌入式应用在 iframe 中使用，通过 postMessage 与 Portal 通信
 *
 * 用法：
 *   <script src="/hubforge-sdk.js"></script>
 *   <script>
 *     const hubforge = new HubForgeSDK();
 *     hubforge.onAuth((data) => {
 *       console.log('用户:', data.user.name);
 *       console.log('权限:', data.permissions);
 *       console.log('Token:', data.token);
 *     });
 *     hubforge.onReady(() => {
 *       console.log('已连接到 HubForge');
 *     });
 *   </script>
 */

(function (root) {
  "use strict";

  /**
   * @typedef {Object} AuthData
   * @property {string} token - JWT Token（可解码获取用户信息，有效期 1 小时）
   * @property {{ id: string, email: string, name: string, tenantId: string }} user - 用户信息
   * @property {string[]} permissions - 当前用户在该应用中的权限 key 列表
   * @property {Record<string, string>} config - 应用配置（合并了全局配置和租户配置）
   * @property {string} appSlug - 应用标识
   */

  function HubForgeSDK(options) {
    options = options || {};
    this._autoRequest = options.autoRequest !== false; // 默认自动请求
    this._authCallbacks = [];
    this._readyCallbacks = [];
    this._errorCallbacks = [];
    this._authData = null;
    this._connected = false;
    this._retryCount = 0;
    this._maxRetries = options.maxRetries || 3;

    this._init();
  }

  HubForgeSDK.prototype._init = function () {
    var self = this;

    window.addEventListener("message", function (event) {
      var data = event.data;
      if (!data || typeof data !== "object") return;

      switch (data.type) {
        case "hubforge:auth":
          self._connected = true;
          self._retryCount = 0;
          self._authData = {
            token: data.token,
            user: data.user,
            permissions: data.permissions || [],
            config: data.config || {},
            appSlug: data.appSlug,
          };
          self._authCallbacks.forEach(function (cb) {
            try { cb(self._authData); } catch (e) { console.error("[HubForge SDK] auth callback error:", e); }
          });
          break;

        case "hubforge:auth-error":
          self._errorCallbacks.forEach(function (cb) {
            try { cb(new Error(data.error || "认证失败")); } catch (e) { console.error("[HubForge SDK] error callback:", e); }
          });
          break;
      }
    });

    // 向 Portal 发送就绪信号
    if (self._autoRequest) {
      self._requestAuth();
    }
  };

  HubForgeSDK.prototype._requestAuth = function () {
    var self = this;
    // 等 iframe 加载完毕后再发消息
    if (document.readyState === "complete") {
      self._sendReady();
    } else {
      window.addEventListener("load", function () {
        self._sendReady();
      });
    }
  };

  HubForgeSDK.prototype._sendReady = function () {
    var self = this;
    // 给 Portal 一点时间准备
    setTimeout(function () {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "hubforge:ready" }, "*");
        self._readyCallbacks.forEach(function (cb) {
          try { cb(); } catch (e) { console.error("[HubForge SDK] ready callback:", e); }
        });
      }
    }, 100);
  };

  /**
   * 注册认证成功回调
   * @param {function(AuthData): void} callback
   * @returns {HubForgeSDK} this（链式调用）
   */
  HubForgeSDK.prototype.onAuth = function (callback) {
    if (typeof callback === "function") {
      this._authCallbacks.push(callback);
      // 如果已经有认证数据，立即触发
      if (this._authData) {
        try { callback(this._authData); } catch (e) { console.error("[HubForge SDK]", e); }
      }
    }
    return this;
  };

  /**
   * 注册连接就绪回调
   * @param {function(): void} callback
   * @returns {HubForgeSDK} this
   */
  HubForgeSDK.prototype.onReady = function (callback) {
    if (typeof callback === "function") {
      this._readyCallbacks.push(callback);
    }
    return this;
  };

  /**
   * 注册错误回调
   * @param {function(Error): void} callback
   * @returns {HubForgeSDK} this
   */
  HubForgeSDK.prototype.onError = function (callback) {
    if (typeof callback === "function") {
      this._errorCallbacks.push(callback);
    }
    return this;
  };

  /**
   * 获取当前认证数据
   * @returns {AuthData|null}
   */
  HubForgeSDK.prototype.getAuth = function () {
    return this._authData;
  };

  /**
   * 获取当前 Token
   * @returns {string|null}
   */
  HubForgeSDK.prototype.getToken = function () {
    return this._authData ? this._authData.token : null;
  };

  /**
   * 检查是否有某个权限
   * @param {string} permissionKey
   * @returns {boolean}
   */
  HubForgeSDK.prototype.hasPermission = function (permissionKey) {
    if (!this._authData) return false;
    return this._authData.permissions.indexOf(permissionKey) !== -1;
  };

  /**
   * 获取应用配置值
   * @param {string} key
   * @param {string} [defaultValue]
   * @returns {string|undefined}
   */
  HubForgeSDK.prototype.getConfig = function (key, defaultValue) {
    if (!this._authData || !this._authData.config) return defaultValue;
    return this._authData.config[key] || defaultValue;
  };

  /**
   * 请求重新认证（Token 过期时使用）
   */
  HubForgeSDK.prototype.refreshAuth = function () {
    if (window.parent && window.parent !== window) {
      this._authData = null;
      window.parent.postMessage({ type: "hubforge:request-auth" }, "*");
    }
  };

  /**
   * 请求关闭应用（返回 Portal 首页）
   */
  HubForgeSDK.prototype.close = function () {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "hubforge:close" }, "*");
    }
  };

  /**
   * 请求页面跳转
   * @param {string} url - Portal 内的路径
   */
  HubForgeSDK.prototype.navigate = function (url) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "hubforge:navigate", url: url }, "*");
    }
  };

  /**
   * 通知 Portal 调整 iframe 高度
   * @param {number} height - 像素值
   */
  HubForgeSDK.prototype.resize = function (height) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "hubforge:resize", height: height }, "*");
    }
  };

  /**
   * 判断是否运行在 HubForge iframe 内
   * @returns {boolean}
   */
  HubForgeSDK.prototype.isEmbedded = function () {
    try {
      return window.parent !== window;
    } catch (e) {
      return false;
    }
  };

  // 导出
  if (typeof define === "function" && define.amd) {
    define(function () { return HubForgeSDK; });
  } else if (typeof module === "object" && module.exports) {
    module.exports = HubForgeSDK;
  } else {
    root.HubForgeSDK = HubForgeSDK;
  }
})(typeof window !== "undefined" ? window : this);
