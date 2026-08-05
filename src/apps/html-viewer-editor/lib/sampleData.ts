export const defaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0; 
            background-color: #f4f4f9; 
            color: #333; 
        }
        .card { 
            background: white; 
            padding: 2.5rem; 
            border-radius: 12px; 
            box-shadow: 0 10px 15px rgba(0,0,0,0.1); 
            text-align: center;
            max-width: 400px;
        }
        h1 { color: #2563eb; margin-top: 0; }
        p { color: #64748b; line-height: 1.6; }
        button { 
            padding: 12px 24px; 
            border: none; 
            background: #2563eb; 
            color: white; 
            border-radius: 6px; 
            cursor: pointer; 
            font-size: 16px; 
            font-weight: 600;
            margin-top: 20px; 
            transition: background 0.3s;
        }
        button:hover { background: #1d4ed8; }
    </style>
</head>
<body>
    <div class="card">
        <h1>HTML Pro Editor</h1>
        <p>Start writing your HTML, CSS, and JS. Use the toolbar above to switch devices, format code, and inspect the DOM.</p>
        <button onclick="alert('JavaScript execution is fully supported in the sandbox!')">Click Me!</button>
    </div>
</body>
</html>`;
