export const defaultHtml = "<!DOCTYPE html>\n" +
"<html lang="en">\n" +
"<head>\n" +
"    <meta charset="UTF-8">\n" +
"    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n" +
"    <title>Hello World</title>\n" +
"    <style>\n" +
"        body { \n" +
"            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; \n" +
"            display: flex; \n" +
"            justify-content: center; \n" +
"            align-items: center; \n" +
"            height: 100vh; \n" +
"            margin: 0; \n" +
"            background-color: #f4f4f9; \n" +
"            color: #333; \n" +
"        }\n" +
"        .card { \n" +
"            background: white; \n" +
"            padding: 2.5rem; \n" +
"            border-radius: 12px; \n" +
"            box-shadow: 0 10px 15px rgba(0,0,0,0.1); \n" +
"            text-align: center;\n" +
"            max-width: 400px;\n" +
"        }\n" +
"        h1 { color: #2563eb; margin-top: 0; }\n" +
"        p { color: #64748b; line-height: 1.6; }\n" +
"        button { \n" +
"            padding: 12px 24px; \n" +
"            border: none; \n" +
"            background: #2563eb; \n" +
"            color: white; \n" +
"            border-radius: 6px; \n" +
"            cursor: pointer; \n" +
"            font-size: 16px; \n" +
"            font-weight: 600;\n" +
"            margin-top: 20px; \n" +
"            transition: background 0.3s;\n" +
"        }\n" +
"        button:hover { background: #1d4ed8; }\n" +
"    </style>\n" +
"</head>\n" +
"<body>\n" +
"    <div class="card">\n" +
"        <h1>HTML Pro Editor</h1>\n" +
"        <p>Start writing your HTML, CSS, and JS. Use the toolbar above to switch devices, format code, and inspect the DOM.</p>\n" +
"        <button onclick="alert('JavaScript execution is fully supported in the sandbox!')">Click Me!</button>\n" +
"    </div>\n" +
"</body>\n" +
"</html>";