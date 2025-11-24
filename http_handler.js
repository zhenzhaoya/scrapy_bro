const path = require('path');
const https = require('https');
const { URL } = require('url');
const fs = require('fs').promises;
const zlib = require('zlib');

class HttpHandler {
    constructor() {
        // 基类构造函数
        this.baseDir = path.join(__dirname, 'downloads');
        this.logDomains = ['davidjones.com', 'davidjonesau']; // 需要记录日志的域名列表
    }

    // 保存 Buffer 数据
    async saveBuffer(filename, buffer) {
        try {
            const filePath = path.join(this.baseDir, filename);
            await fs.writeFile(filePath, buffer);
            // console.log(`✅ Buffer 文件保存成功: ${filePath}`);
            return filePath;
        } catch (error) {
            console.error('❌ 保存 Buffer 文件失败:', error);
            throw error;
        }
    }

    async log_response(request, response) {
        // var should_log = false;
        // for (let i = 0; i < this.logDomains.length; i++) {
        //     if (request.url.split("?")[0].includes(this.logDomains[i])) {
        //         should_log = true;
        //         break;
        //     }
        // }
        // if (!should_log || request.resourceType === 'image' || request.resourceType === 'font' || request.resourceType === 'stylesheet' || request.url.includes("_next/static")) {
        //     // console.log('Request type, URL:',details.type, details.resourceType, details.url); // 查看请求的 URL
        //     // new_url = new_url.replace(/https:\/\/[^\/]+/, "http://localhost:7777");
        //     return;
        // }

        const cloned = response;
        let bodyPreview = '';

        try {
            const filename = `${Date.now()}_${request.method}_${request.url.split('?')[0].split('//')[1]}`.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 100);
            const req_headers = JSON.stringify(request.requestHeaders);
            const resp_headers = JSON.stringify(cloned.headers);
            var content = Buffer.from(request.method + " " + request.url.toString() + "\n===========request header================\n" +
                req_headers + "\n===========response header===============\n"
                + resp_headers);

            const content_resp = this.convert_response_data(cloned);// cloned.responseData;
            if (request.method === 'POST') {
                const content_req = this.get_upload_data(request);
                content = content + Buffer.from("\n===========post data=====================\n") + Buffer.from(content_req) + Buffer.from("\n============response data===============\n") + Buffer.from(content_resp);
            } else {
                content = content + Buffer.from("\n===========response data=================\n") + Buffer.from(content_resp);
            }
            bodyPreview = `保存响应内容到文件: ${filename} (大小: ${content.length} bytes)`;
            await this.saveBuffer(filename, content);
        } catch (error) {
            bodyPreview = `[读取响应体失败: ${error.message}, ${request.url}]`;
        }

        console.log('📦 响应预览:', bodyPreview);
    }

    convert_response_data(response) {
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('application/json') || contentType.startsWith('text/') || contentType.includes('application/javascript') || contentType.includes('application/xml')) {
            return response.responseData.toString('utf8');
        } else if (contentType.includes("br")) {
            return response.responseData.toString('utf8');
        } else {
            return `[非文本响应，内容长度: ${response.responseData.length} bytes]`;
        }
    }


    get_upload_data(details) {
        if (details.uploadData && details.uploadData.length > 0) {
            for (let index = 0; index < details.uploadData.length; index++) {
                const dataPart = details.uploadData[index];
                if (dataPart.bytes) {
                    try {
                        const postDataString = dataPart.bytes.toString('utf8');
                        // console.log(`POST 数据 (部分 ${index + 1}):`, postDataString);
                        return postDataString;
                    } catch (error) {
                        console.error('❌ 读取 POST 数据失败:', error);
                    }
                }
            };
        }
        return "";
    }

    check_need_log(request) {
        var should_log = false;
        for (let i = 0; i < this.logDomains.length; i++) {
            if (request.url.split("?")[0].includes(this.logDomains[i])) {
                should_log = true;
                break;
            }
        }
        if (!should_log || !request.url.startsWith("https://") || request.resourceType === 'image' || request.resourceType === 'font' || request.resourceType === 'stylesheet' || request.url.includes("_next/static")) {
            // console.log('Request type, URL:',details.type, details.resourceType, details.url); // 查看请求的 URL
            // new_url = new_url.replace(/https:\/\/[^\/]+/, "http://localhost:7777");
            return false;
        }
        return true;
    }
    async handleHttpsRequest(request) {
        var should_log = this.check_need_log(request);
        if (!should_log) {
            return;
        }
        const startTime = Date.now();
        // console.log('🔗 处理 HTTPS 请求:', request.url);

        try {
            const url = new URL(request.url);
            let headers = { ...request.requestHeaders };
            // if (cookies) {
            //     headers['Cookie'] = cookies;
            // }
            const options = {
                referer: request.referrer,
                resourceType: request.resourceType,
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: request.method,
                headers: headers, //this.prepareHeaders(request.headers),
                rejectUnauthorized: false, // 允许自签名证书
                timeout: 30000
            };
            for (let i =0; i < 2; i++) {
                try {
                    const response = await this.makeHttpsRequest(options, request);
                    await this.log_response(request, response);
                    const duration = Date.now() - startTime;
                    console.log(`✅ 请求成功: ${request.id} ${response.status} (${duration}ms)`);
                    return response;
                } catch (error) {
                    console.error('❌ HTTPS 请求失败:', error);
                    return this.createErrorResponse(500, `HTTPS request failed: ${error.message}`);
                }
            }
        } catch (error) {
            console.error('❌ HTTPS 请求失败:', error);
            return this.createErrorResponse(500, `HTTPS request failed: ${error.message}`);
        }
    }

    createErrorResponse(status, message) {
        const errorData = JSON.stringify({
            error: true,
            status: status,
            message: message,
            timestamp: new Date().toISOString()
        });

        return new Response(errorData, {
            status: status,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
    }

    async handleRequestBody(req, originalRequest) {
        if (originalRequest.body &&
            originalRequest.method !== 'GET' &&
            originalRequest.method !== 'HEAD') {

            try {
                const bodyBuffer = this.get_upload_data(originalRequest)
                if (bodyBuffer.byteLength > 0) {
                    req.write(Buffer.from(bodyBuffer));
                    // console.log('📤 发送请求体:', bodyBuffer.byteLength, 'bytes');
                }
            } catch (error) {
                console.warn('⚠️ 读取请求体失败:', error);
            }
        }
    }

    makeHttpsRequest(options, originalRequest) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            let responseHeaders = {};
            let statusCode = 200;
            let statusMessage = 'OK';

            const req = https.request(options, (res) => {
                statusCode = res.statusCode;
                statusMessage = res.statusMessage;
                responseHeaders = { ...res.headers };

                // console.log('📨 收到响应:', JSON.stringify({
                //     status: statusCode,
                //     headers: Object.keys(responseHeaders)
                // }));

                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    const responseData = Buffer.concat(chunks);

                    // console.log('📦 响应数据长度:', responseData.length);
                    if (responseHeaders['content-encoding'] === 'br') {
                        try {
                            const decompressed = zlib.brotliDecompressSync(responseData);
                            return resolve({
                                status: statusCode,
                                statusText: statusMessage,
                                headers: responseHeaders,
                                responseData: decompressed
                            });
                        } catch (error) {
                            console.error('❌ Brotli 解压失败:', error);
                        }
                    }else if (responseHeaders['content-encoding'] === 'gzip') {
                        try {
                            const decompressed = zlib.gunzipSync(responseData);
                            return resolve({
                                status: statusCode,
                                statusText: statusMessage,
                                headers: responseHeaders,
                                responseData: decompressed
                            });
                        } catch (error) {
                            console.error('❌ Gzip 解压失败:', error);
                        }
                    } else if (responseHeaders['content-encoding'] === 'deflate') {
                        try {
                            const decompressed = zlib.inflateSync(responseData);
                            return resolve({
                                status: statusCode,
                                statusText: statusMessage,
                                headers: responseHeaders,
                                responseData: decompressed
                            });
                        } catch (error) {
                            console.error('❌ Deflate 解压失败:', error);
                        }
                    } else {
                        const response = {
                            status: statusCode,
                            statusText: statusMessage,
                            headers: responseHeaders,
                            responseData: responseData
                        };
                        return resolve(response);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('❌ 请求错误:', error, originalRequest.url);
                reject(error);
            });

            req.on('timeout', () => {
                console.error('⏰ 请求超时', originalRequest.url);
                req.destroy();
                reject(new Error('Request timeout'));
            });

            // 处理请求体
            this.handleRequestBody(req, originalRequest)
                .then(() => {
                    req.end();
                })
                .catch(reject);
        });
    }
}

module.exports = HttpHandler;
