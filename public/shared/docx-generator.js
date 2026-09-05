(function () {
    'use strict';

    /*
     * Shared browser-side DOCX generator.
     *
     * Responsibilities:
     * - Load TurboDocx safely
     * - Normalize/validate HTML input
     * - Generate A4 DOCX
     * - Normalize TurboDocx output to a Blob
     * - Validate the generated file is a ZIP/DOCX container
     * - Safely download the generated document
     * - Prevent overlapping generation/download races
     */

    const TURBODOCX_PATH = '/turbodocx-test/turbodocx.browser.esm.js';

    const DOCX_MIME =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const A4_WIDTH_TWIPS = 11906;
    const A4_HEIGHT_TWIPS = 16838;

    const DEFAULT_MARGINS = {
        top: 1440,
        bottom: 1440,
        left: 1440,
        right: 1440
    };

    let turboDocxPromise = null;
    let generationQueue = Promise.resolve();

    function ensurePolyfills() {
        if (typeof window === 'undefined') {
            throw new Error('TurboDocx requires a browser environment');
        }

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

                    if (data instanceof ArrayBuffer) {
                        return new Uint8Array(data);
                    }

                    if (ArrayBuffer.isView(data)) {
                        return new Uint8Array(
                            data.buffer,
                            data.byteOffset,
                            data.byteLength
                        );
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
                        throw new Error(
                            'TurboDocx module loaded but HTMLToDOCX was not found'
                        );
                    }

                    return HTMLToDOCX;
                })
                .catch(function (error) {
                    /*
                     * Never poison the cached promise after a failed import.
                     * A later attempt should be able to retry the module load.
                     */
                    turboDocxPromise = null;

                    const message =
                        error && error.message
                            ? error.message
                            : String(error);

                    throw new Error(
                        'Unable to load TurboDocx: ' + message
                    );
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
        return (
            '<!DOCTYPE html>' +
            '<html lang="hi-IN">' +
            '<head>' +
            '<meta charset="UTF-8">' +
            '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">' +
            '</head>' +
            '<body>' +
            html +
            '</body>' +
            '</html>'
        );
    }

    function hasMeaningfulContent(html) {
        if (typeof html !== 'string') {
            return false;
        }

        const trimmed = html.trim();

        if (!trimmed) {
            return false;
        }

        /*
         * Parse the HTML so whitespace, empty spans and formatting markup
         * do not incorrectly count as document content.
         */
        let container;

        try {
            container = document.createElement('div');
            container.innerHTML = trimmed;
        } catch (error) {
            return false;
        }

        /*
         * Remove non-document content from the text test.
         */
        const removable = container.querySelectorAll(
            'script, style, noscript, template'
        );

        for (let i = 0; i < removable.length; i++) {
            removable[i].remove();
        }

        const text = (container.textContent || '')
            .replace(/\u200B/g, '')
            .replace(/\uFEFF/g, '')
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (text.length > 0) {
            return true;
        }

        /*
         * Text is not mandatory if the document intentionally contains
         * visual content such as images or tables.
         */
        if (container.querySelector('img, table, hr, svg, canvas')) {
            return true;
        }

        /*
         * A content-bearing link can technically contain only an image,
         * already covered above. Empty markup should remain invalid.
         */
        return false;
    }

    function normalizeTurboResult(result) {
        if (result instanceof Blob) {
            return new Blob([result], {
                type: DOCX_MIME
            });
        }

        if (result instanceof Uint8Array) {
            return new Blob([result], {
                type: DOCX_MIME
            });
        }

        if (result instanceof ArrayBuffer) {
            return new Blob([new Uint8Array(result)], {
                type: DOCX_MIME
            });
        }

        /*
         * Node Buffer or Buffer-like result.
         * This is deliberately handled without depending on instanceof
         * Buffer because browser polyfills can expose different shapes.
         */
        if (
            result &&
            typeof result === 'object' &&
            typeof result.byteLength === 'number' &&
            result.buffer instanceof ArrayBuffer
        ) {
            return new Blob(
                [
                    new Uint8Array(
                        result.buffer,
                        result.byteOffset || 0,
                        result.byteLength
                    )
                ],
                {
                    type: DOCX_MIME
                }
            );
        }

        if (
            result &&
            typeof result === 'object' &&
            typeof result.length === 'number'
        ) {
            try {
                return new Blob(
                    [Uint8Array.from(result)],
                    {
                        type: DOCX_MIME
                    }
                );
            } catch (error) {
                // Fall through to the explicit error below.
            }
        }

        throw new Error(
            'TurboDocx returned an unsupported document format'
        );
    }

    async function validateDocxBlob(blob) {
        if (!(blob instanceof Blob)) {
            throw new Error('Generated DOCX is not a valid Blob');
        }

        if (blob.size < 1000) {
            throw new Error(
                'Generated DOCX is unexpectedly small or empty'
            );
        }

        /*
         * DOCX is an OOXML ZIP package.
         * ZIP local-file-header signature = PK 03 04.
         */
        const header = new Uint8Array(
            await blob.slice(0, 4).arrayBuffer()
        );

        const isZip =
            header.length === 4 &&
            header[0] === 0x50 &&
            header[1] === 0x4B &&
            (
                (
                    header[2] === 0x03 &&
                    header[3] === 0x04
                ) ||
                (
                    header[2] === 0x05 &&
                    header[3] === 0x06
                ) ||
                (
                    header[2] === 0x07 &&
                    header[3] === 0x08
                )
            );

        if (!isZip) {
            throw new Error(
                'TurboDocx returned data that is not a valid DOCX/ZIP package'
            );
        }

        return true;
    }

    function triggerDownload(blob, filename) {
        const objectUrl = URL.createObjectURL(blob);

        try {
            const link = document.createElement('a');

            link.href = objectUrl;
            link.download = filename;
            link.rel = 'noopener';
            link.style.display = 'none';

            document.body.appendChild(link);

            try {
                link.click();
            } finally {
                link.remove();
            }
        } finally {
            /*
             * Keep the object URL alive briefly so Chromium/WebView has
             * enough time to consume the download request.
             */
            setTimeout(function () {
                try {
                    URL.revokeObjectURL(objectUrl);
                } catch (error) {
                    // Ignore cleanup failures.
                }
            }, 10000);
        }
    }

    async function generateDocxInternal(html, filename) {
        if (typeof html !== 'string') {
            throw new Error('Document HTML must be a string');
        }

        if (!hasMeaningfulContent(html)) {
            throw new Error(
                'Document is empty. Please generate or fill the document before downloading.'
            );
        }

        const HTMLToDOCX = await loadTurboDocx();

        const cleanHtml = createDocumentHtml(html);

        const options = {
            margins: {
                top: DEFAULT_MARGINS.top,
                bottom: DEFAULT_MARGINS.bottom,
                left: DEFAULT_MARGINS.left,
                right: DEFAULT_MARGINS.right
            },

            pageWidth: A4_WIDTH_TWIPS,
            pageHeight: A4_HEIGHT_TWIPS,

            table: {
                row: {
                    cantSplit: true
                }
            },

            /*
             * This is the fallback/default font only.
             * Explicit font-family styles already present in the source
             * HTML should remain responsible for specific text runs.
             */
            font: 'Segoe UI'
        };

        let result;

        try {
            result = await HTMLToDOCX(
                cleanHtml,
                null,
                options
            );
        } catch (error) {
            const message =
                error && error.message
                    ? error.message
                    : String(error);

            throw new Error(
                'TurboDocx generation failed: ' + message
            );
        }

        if (result == null) {
            throw new Error(
                'TurboDocx returned no document data'
            );
        }

        const blob = normalizeTurboResult(result);

        await validateDocxBlob(blob);

        const safeFilename = sanitizeFilename(filename);

        triggerDownload(blob, safeFilename);

        return {
            blob: blob,
            filename: safeFilename,
            size: blob.size
        };
    }

    /*
     * Serialize generations.
     *
     * This prevents two simultaneous calls from competing around the
     * browser download lifecycle while still allowing normal consecutive
     * calls:
     *
     * await generateDocx(...)
     * await generateDocx(...)
     * await generateDocx(...)
     *
     * Each call gets its own TurboDocx generation.
     */
    function generateDocx(html, filename) {
        const run = generationQueue
            .catch(function () {
                /*
                 * A previous failure must not permanently reject the queue.
                 */
            })
            .then(function () {
                return generateDocxInternal(html, filename);
            });

        generationQueue = run.catch(function () {
            // Keep the queue usable after a failed generation.
        });

        return run;
    }

    /*
     * Optional diagnostics for manual testing.
     * Does not affect normal production behavior.
     */
    window.generateDocx = generateDocx;

    window.__turboDocxDiagnostics = {
        load: loadTurboDocx,
        hasMeaningfulContent: hasMeaningfulContent,
        validateDocxBlob: validateDocxBlob,
        constants: {
            A4_WIDTH_TWIPS: A4_WIDTH_TWIPS,
            A4_HEIGHT_TWIPS: A4_HEIGHT_TWIPS
        }
    };
})();
