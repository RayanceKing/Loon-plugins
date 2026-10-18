// Loon http-request 脚本：将 tmdbId 转换为 anime 参数
// 通过 $argument 读取用户自定义的域名和 TMDB API Key

// 解析 Loon 传入的 argument
function parseArgument() {
    let args = {};
    try {
        if (typeof $argument === 'string' && $argument.length > 0) {
            // Loon 传入格式可能是 JSON 或 key=value&key2=value2
            if ($argument.trim().startsWith('{')) {
                args = JSON.parse($argument);
            } else {
                $argument.split('&').forEach(pair => {
                    const idx = pair.indexOf('=');
                    if (idx > 0) {
                        const k = pair.substring(0, idx).trim();
                        const v = pair.substring(idx + 1).trim();
                        args[k] = v;
                    }
                });
            }
        }
    } catch (e) {
        console.log('[Danmaku] argument 解析失败: ' + e);
    }
    return args;
}

const ARGS = parseArgument();
const DANMAKU_HOST = (ARGS.DanmakuHost || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const TMDB_API_KEY = ARGS.TmdbApiKey || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

function getQueryParam(url, name) {
    const match = url.match(new RegExp('[?&]' + name + '=([^&]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

function removeParam(url, name) {
    return url.replace(new RegExp('([?&])' + name + '=[^&]*&?'), '$1').replace(/[?&]$/, '');
}

function addParam(url, name, value) {
    const sep = url.includes('?') ? '&' : '?';
    return url + sep + name + '=' + encodeURIComponent(value);
}

function fetchTitle(tmdbId, callback) {
    if (!TMDB_API_KEY) {
        console.log('[Danmaku] 未配置 TMDB API Key，跳过');
        callback(null);
        return;
    }
    const url = TMDB_BASE + '/tv/' + tmdbId + '?api_key=' + TMDB_API_KEY + '&language=zh-CN';
    $httpClient.get(url, function(error, response, data) {
        if (error || !data) {
            console.log('[Danmaku] TMDB 请求失败: ' + error);
            callback(null);
            return;
        }
        try {
            const json = JSON.parse(data);
            const title = json.name || json.original_name;
            console.log('[Danmaku] tmdbId=' + tmdbId + ' -> ' + title);
            callback(title);
        } catch (e) {
            console.log('[Danmaku] JSON 解析失败: ' + e);
            callback(null);
        }
    });
}

(function() {
    const url = $request.url;

    // 域名校验：只处理用户配置的 danmaku 域名
    if (DANMAKU_HOST) {
        const hostMatch = url.match(/^https?:\/\/([^\/]+)/);
        const reqHost = hostMatch ? hostMatch[1].split(':')[0] : '';
        if (reqHost !== DANMAKU_HOST) {
            console.log('[Danmaku] 非目标域名 ' + reqHost + '，放行');
            $done({});
            return;
        }
    }

    const tmdbId = getQueryParam(url, 'tmdbId');
    if (!tmdbId) {
        console.log('[Danmaku] 无 tmdbId，放行');
        $done({});
        return;
    }

    fetchTitle(tmdbId, function(title) {
        if (!title) {
            console.log('[Danmaku] 无法获取标题，原样放行');
            $done({});
            return;
        }

        let newUrl = removeParam(url, 'tmdbId');
        newUrl = addParam(newUrl, 'anime', title);

        console.log('[Danmaku] 改写 URL: ' + newUrl);
        $done({ url: newUrl });
    });
})();