import fsp from "node:fs/promises";
import path from "node:path";
import { ensureDir, safeSlug } from "./utils.js";
// Debug logging helper for MCP context
async function debugLog(message) {
    try {
        const logFile = path.join(process.cwd(), 'sitepaige-debug.log');
        const timestamp = new Date().toISOString();
        await fsp.appendFile(logFile, `[${timestamp}] ${message}\n`);
    }
    catch {
        // Silently fail if can't write log
    }
}
// Helper function to generate TypeScript type from ObjectProperty
function generateTypeFromProperty(prop, objects) {
    switch (prop.type) {
        case 'string':
            return 'string';
        case 'number':
            return 'number';
        case 'boolean':
            return 'boolean';
        case 'object':
            if (prop.object_id) {
                const obj = objects.find(o => o.id === prop.object_id);
                return obj ? obj.name : 'any';
            }
            return 'any';
        case 'array':
            if (prop.array_item_type === 'object' && prop.array_item_object_id) {
                const obj = objects.find(o => o.id === prop.array_item_object_id);
                return obj ? `${obj.name}[]` : 'any[]';
            }
            return `${prop.array_item_type || 'any'}[]`;
        default:
            return 'any';
    }
}
// Helper function to generate TypeScript interface from ObjectDefinition
function generateInterface(obj, objects) {
    const props = obj.properties.map(prop => {
        const type = generateTypeFromProperty(prop, objects);
        const optional = prop.required ? '' : '?';
        const description = prop.description ? `  // ${prop.description}\n` : '';
        return `${description}  ${prop.name}${optional}: ${type};`;
    }).join('\n');
    return `interface ${obj.name} {\n${props}\n}`;
}
// Helper function to generate dummy data for a type
function generateDummyValue(prop, objects) {
    switch (prop.type) {
        case 'string':
            return `"sample ${prop.name}"`;
        case 'number':
            return '0';
        case 'boolean':
            return 'false';
        case 'object':
            if (prop.object_id) {
                const obj = objects.find(o => o.id === prop.object_id);
                if (obj) {
                    return generateDummyObject(obj, objects);
                }
            }
            return '{}';
        case 'array':
            return '[]';
        default:
            return 'null';
    }
}
// Helper function to generate dummy object
function generateDummyObject(obj, objects) {
    const props = obj.properties
        .filter(prop => prop.required)
        .map(prop => {
        const value = generateDummyValue(prop, objects);
        return `    ${prop.name}: ${value}`;
    }).join(',\n');
    return props ? `{\n${props}\n  }` : '{}';
}
// Generate API stub with proper input/output types
function generateApiStub(api, blueprint, handler) {
    const objects = blueprint.objects || [];
    const interfaces = [];
    const interfaceNames = new Set();
    // Collect all needed interfaces
    let inputType = '';
    let outputType = '';
    if (api.input_object_id) {
        const inputObj = objects.find(o => o.id === api.input_object_id);
        if (inputObj && !interfaceNames.has(inputObj.name)) {
            interfaces.push(generateInterface(inputObj, objects));
            interfaceNames.add(inputObj.name);
            inputType = inputObj.name;
            // Add any nested object interfaces
            collectNestedInterfaces(inputObj, objects, interfaces, interfaceNames);
        }
    }
    if (api.output_object_id) {
        const outputObj = objects.find(o => o.id === api.output_object_id);
        if (outputObj && !interfaceNames.has(outputObj.name)) {
            interfaces.push(generateInterface(outputObj, objects));
            interfaceNames.add(outputObj.name);
            outputType = outputObj.name;
            // Add any nested object interfaces
            collectNestedInterfaces(outputObj, objects, interfaces, interfaceNames);
        }
    }
    // Generate the function signature
    let functionSignature = '';
    let responseBody = '';
    // Add API prompt as a comment if it exists
    let promptComment = '';
    if (api.prompt) {
        // Format the prompt as a multi-line comment
        const promptLines = api.prompt.split('\n').map(line => ` * ${line}`).join('\n');
        promptComment = `/**\n * API Prompt:\n${promptLines}\n */\n`;
    }
    if (handler === 'GET') {
        // GET requests use query parameters
        functionSignature = inputType
            ? `${promptComment}export async function ${handler}(request: NextRequest)`
            : `${promptComment}export async function ${handler}()`;
        if (inputType) {
            functionSignature += ` {\n  // Extract query parameters\n  const searchParams = request.nextUrl.searchParams;\n  // TODO: Parse searchParams into ${inputType} object\n  const _input: ${inputType} | undefined = undefined; // Placeholder to avoid unused variable error\n`;
        }
        else {
            functionSignature += ' {';
        }
    }
    else {
        // POST/PUT/DELETE use request body
        functionSignature = `${promptComment}export async function ${handler}(request: NextRequest) {`;
        if (inputType) {
            functionSignature += `\n  // Parse request body\n  const _body: ${inputType} = await request.json();\n  // TODO: Validate and use the input data`;
        }
    }
    // Generate response
    if (outputType) {
        const outputObj = objects.find(o => o.id === api.output_object_id);
        if (outputObj) {
            responseBody = generateDummyObject(outputObj, objects);
        }
        else {
            responseBody = '{}';
        }
        functionSignature += `\n\n  // TODO: Implement actual logic here\n  const response: ${outputType} = ${responseBody};\n\n  return NextResponse.json(response);\n}`;
    }
    else {
        functionSignature += `\n\n  // TODO: Implement actual logic here\n  return NextResponse.json({ ok: true, api: ${JSON.stringify(api.name || "api")} });\n}`;
    }
    // Combine everything
    const imports = `import { NextRequest, NextResponse } from 'next/server';\n`;
    const interfaceSection = interfaces.length > 0 ? `\n${interfaces.join('\n\n')}\n` : '';
    return imports + interfaceSection + '\n' + functionSignature;
}
// Helper to collect nested object interfaces
function collectNestedInterfaces(obj, objects, interfaces, interfaceNames) {
    for (const prop of obj.properties) {
        if (prop.type === 'object' && prop.object_id) {
            const nestedObj = objects.find(o => o.id === prop.object_id);
            if (nestedObj && !interfaceNames.has(nestedObj.name)) {
                interfaces.push(generateInterface(nestedObj, objects));
                interfaceNames.add(nestedObj.name);
                collectNestedInterfaces(nestedObj, objects, interfaces, interfaceNames);
            }
        }
        else if (prop.type === 'array' && prop.array_item_type === 'object' && prop.array_item_object_id) {
            const nestedObj = objects.find(o => o.id === prop.array_item_object_id);
            if (nestedObj && !interfaceNames.has(nestedObj.name)) {
                interfaces.push(generateInterface(nestedObj, objects));
                interfaceNames.add(nestedObj.name);
                collectNestedInterfaces(nestedObj, objects, interfaces, interfaceNames);
            }
        }
    }
}
export async function writeApis(targetDir, blueprint, projectCode) {
    const apiDir = path.join(targetDir, "src", "app", "api");
    ensureDir(apiDir);
    const apis = blueprint.apis || [];
    const codeGroups = projectCode.apis || [];
    await debugLog('[writeApis] APIs count: ' + apis.length);
    await debugLog('[writeApis] Code groups count: ' + codeGroups.length);
    // Define user tiers for conversion
    const tiers = [
        { "name": "Free", "paid": false, "description": "Free tier", "yearly_price": 0, "monthly_price": 0 },
        { "name": "Basic", "paid": true, "description": "Basic tier", "yearly_price": 100, "monthly_price": 10 },
        { "name": "Pro", "paid": true, "description": "Pro tier", "yearly_price": 200, "monthly_price": 20 },
        { "name": "Enterprise", "paid": true, "description": "Enterprise tier", "yearly_price": 300, "monthly_price": 30 }
    ];
    // Function to get tier index from tier name
    const getTierIndex = (tierName) => {
        const index = tiers.findIndex(tier => tier.name === tierName);
        return index >= 0 ? index : 0; // Default to Free tier if not found
    };
    for (const api of apis) {
        const routeDir = path.join(apiDir, safeSlug(api.name || api.id || "api"));
        ensureDir(routeDir);
        await debugLog(`[writeApis] Processing API: ${api.id}, name: ${api.name}`);
        let apiCode = "";
        const group = codeGroups.find((g) => g.id === api.id);
        await debugLog(`[writeApis] Found code group for API ${api.id}: ${group ? 'yes' : 'no'}`);
        if (group && group.apis && group.apis[0]?.code) {
            apiCode = group.apis[0].code;
            await debugLog(`[writeApis] API code length: ${apiCode.length}`);
        }
        if (!apiCode) {
            const method = (api.method || "GET").toUpperCase();
            const handler = method === "GET" ? "GET" : method === "POST" ? "POST" : method === "PUT" ? "PUT" : "DELETE";
            const stub = generateApiStub(api, blueprint, handler);
            await fsp.writeFile(path.join(routeDir, "route.ts"), stub, "utf8");
            continue;
        }
        // Build auth code if required
        let authCode = '';
        if (api.requires_auth === 'admin' || api.requires_auth === 'registereduser') {
            authCode = `
    const UserInfo = await check_auth(db, db_query);
    if (UserInfo.userid.length === 0) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
    const user_id = UserInfo.userid;
`;
            if (api.requires_auth === 'admin') {
                authCode += `
    if (UserInfo.IsAdmin !== true) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
`;
            }
            if (api.user_tier && api.user_tier !== '') {
                const requiredTierIndex = getTierIndex(api.user_tier);
                authCode += `
    if (UserInfo.UserTier < ${requiredTierIndex}) { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
`;
            }
        }
        // Replace the auth code placeholder in the API code
        const processedApiCode = apiCode.replace('/* AUTH CODE (NOT AI GENERATED) */', authCode);
        // Calculate relative path from API route to app root (defaultapp)
        const depth = (api.name || api.id || "api").split('/').filter(Boolean).length;
        const relativePathToRoot = '../'.repeat(depth + 1); // +2 for api/routename
        const header = `/* 
This file is generated by Sitepaige. 
*/
import { NextRequest, NextResponse } from 'next/server';
import { check_auth } from '${relativePathToRoot}auth/auth';
import { store_file } from '${relativePathToRoot}storage/files';
import { db_init, db_query } from '${relativePathToRoot}db';
`;
        const routeCode = header + "\n" + processedApiCode + "\n";
        await fsp.writeFile(path.join(routeDir, "route.ts"), routeCode, "utf8");
    }
}
//# sourceMappingURL=apis.js.map