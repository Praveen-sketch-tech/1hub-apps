(function () {
    'use strict';

    const TURBODOCX_PATH = '../turbodocx-test/turbodocx.browser.esm.js';

    let turboDocxPromise = null;

    function ensurePolyfills() {
        if (typeof global === 'undefined') {
            window.global = window;
        }

        if (typeof process === 'undefined') {
            window.process = {
                env: {}
            };
        }

        if (typeof Buffer === 'undefined') {
            window.Buffer = {
                from: function (data, encoding) {
                    if (typeof data === 'string') {
                        if (encoding === 'base64') {
                            const binary = atob(data);
                            const bytes = new Uint8Array(binary.length);

                            for (let i = 0; i < binary.length; i++) {
                                bytes[i] = binary.charCodeAt(i);
                            }

                            return bytes;
                        }

                        return new TextEncoder().encode(data);
                    }

                    return new Uint8Array(data);
                },

                isBuffer: function () {
                    return false;
                }
            };
        }
    }

    async function loadTurboDocx() {
        if (!turboDocxPromise) {
            ensurePolyfills();

            turboDocxPromise = import(TURBODOCX_PATH)
                .then(function (module) {
                    const HTMLToDOCX = module.default || module;

                    if (typeof HTMLToDOCX !== 'function') {
                        throw new Error('TurboDocx module loaded but HTMLToDOCX was not found');
                    }

                    return HTMLToDOCX;
                })
                .catch(function (error) {
                    turboDocxPromise = null;
                    throw error;
                });
        }

        return turboDocxPromise;
    }

    function sanitizeFilename(filename) {
        let name = String(filename || 'document')
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .replace(/\s+/g, ' ')
            .trim();

        if (!name) {
            name = 'document';
        }

        if (!/\.docx$/i.test(name)) {
            name += '.docx';
        }

        return name;
    }

    function createDocumentHtml(html) {
        return '<!DOCTYPE html>' +
            '<html>' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '</head>' +
            '<body>' +
            html +
            '</body>' +
            '</html>';
    }

    async function generateDocx(html, filename) {
        if (typeof html !== 'string' || html.trim() === '') {
            throw new Error('Document HTML is empty');
        }

        const HTMLToDOCX = await loadTurboDocx();

        const cleanHtml = createDocumentHtml(html);

        const A4_WIDTH_TWIPS = Math.round(8.27 * 1440);
        const A4_HEIGHT_TWIPS = Math.round(11.69 * 1440);

        const options = {
            margins: {
                top: 1440,
                bottom: 1440,
                left: 1440,
                right: 1440
            },
            pageWidth: A4_WIDTH_TWIPS,
            pageHeight: A4_HEIGHT_TWIPS,
            table: {
                row: {
                    cantSplit: true
                }
            },
            font: 'Segoe UI'
        };

        const result = await HTMLToDOCX(
            cleanHtml,
            null,
            options
        );

        let blob;

        if (result instanceof Blob) {
            blob = result;
        } else if (result instanceof Uint8Array) {
            blob = new Blob([result], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
        } else {
            throw new Error('Unexpected result type from TurboDocx');
        }

        if (!blob || blob.size < 100) {
            throw new Error('Generated DOCX appears to be empty or invalid');
        }

        const safeFilename = sanitizeFilename(filename);

        const objectUrl = URL.createObjectURL(blob);

        try {
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = safeFilename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            setTimeout(function () {
                URL.revokeObjectURL(objectUrl);
            }, 5000);
        }

        return {
            blob: blob,
            filename: safeFilename,
            size: blob.size
        };
    }

    window.generateDocx = generateDocx;
})();
