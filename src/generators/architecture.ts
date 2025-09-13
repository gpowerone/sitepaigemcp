import fs from "node:fs";
import path from "node:path";
import { Blueprint, Model, Api, View, ObjectDefinition, ErDiagram } from "../types.js";
import { ensureDir } from "./utils.js";

export async function writeArchitectureDoc(targetDir: string, blueprint: Blueprint): Promise<void> {
  const architecturePath = path.join(targetDir, "ARCHITECTURE.md");
  
  const content = generateArchitectureContent(blueprint);
  fs.writeFileSync(architecturePath, content, "utf8");
}

function generateArchitectureContent(blueprint: Blueprint): string {
  const sections: string[] = [];
  
  // Header
  sections.push(`# Architecture Documentation`);
  sections.push(``);
  sections.push(`This document provides an overview of the application architecture, including database schema, API endpoints, and view components.`);
  sections.push(``);
  sections.push(`Generated on: ${new Date().toISOString()}`);
  sections.push(``);
  
  // Table of Contents
  sections.push(`## Table of Contents`);
  sections.push(``);
  sections.push(`1. [Database Schema](#database-schema)`);
  sections.push(`2. [API Endpoints](#api-endpoints)`);
  sections.push(`3. [Views and Components](#views-and-components)`);
  sections.push(`4. [Data Flow](#data-flow)`);
  sections.push(``);
  
  // Database Schema Section
  sections.push(`## Database Schema`);
  sections.push(``);
  
  if (blueprint.models && blueprint.models.length > 0) {
    sections.push(`### Tables`);
    sections.push(``);
    
    for (const model of blueprint.models) {
      sections.push(`#### ${model.name}`);
      sections.push(``);
      sections.push(`- **ID**: ${model.id}`);
      sections.push(`- **User-specific data**: ${model.data_is_user_specific || 'No'}`);
      sections.push(`- **State**: ${model.state || 'persistent'}`);
      sections.push(`- **CRUD operations**: ${model.has_db_crud || 'Yes'}`);
      sections.push(``);
      
      if (model.fields && model.fields.length > 0) {
        sections.push(`**Fields:**`);
        sections.push(``);
        sections.push(`| Field Name | Data Type | Size | Required | Key | Searchable | Notes |`);
        sections.push(`|------------|-----------|------|----------|-----|------------|-------|`);
        
        for (const field of model.fields) {
          const notes: string[] = [];
          if (field.is_image === 'true') notes.push('Image');
          if (field.is_file === 'true') notes.push('File');
          if (field.untouchable === 'true') notes.push('System');
          
          sections.push(`| ${field.name} | ${field.datatype} | ${field.datatypesize || '-'} | ${field.required || 'No'} | ${field.key || '-'} | ${field.is_searchable || 'No'} | ${notes.join(', ') || '-'} |`);
        }
        sections.push(``);
      }
      
      // Add authentication requirements
      sections.push(`**Authentication Requirements:**`);
      sections.push(`- Add: ${model.addAuthRequired || 'None'}`);
      sections.push(`- Get: ${model.getAuthRequired || 'None'}`);
      sections.push(`- Update: ${model.updateAuthRequired || 'None'}`);
      sections.push(`- Delete: ${model.deleteAuthRequired || 'None'}`);
      sections.push(``);
    }
    
    // Relationships from ER Diagram
    if (blueprint.er_diagram && blueprint.er_diagram.length > 0) {
      sections.push(`### Relationships`);
      sections.push(``);
      
      for (const diagram of blueprint.er_diagram) {
        const model = blueprint.models.find(m => m.id === diagram.model_id);
        if (model && diagram.relationships && diagram.relationships.length > 0) {
          sections.push(`#### ${model.name} Relationships`);
          sections.push(``);
          
          for (const rel of diagram.relationships) {
            const targetModel = blueprint.models.find(m => m.id === rel.to);
            sections.push(`- **${model.name}.${rel.propA}** → **${targetModel?.name || rel.to}.${rel.propB}** (${rel.type})`);
          }
          sections.push(``);
        }
      }
    }
  } else {
    sections.push(`*No database models defined*`);
    sections.push(``);
  }
  
  // API Endpoints Section
  sections.push(`## API Endpoints`);
  sections.push(``);
  
  if (blueprint.apis && blueprint.apis.length > 0) {
    for (const api of blueprint.apis) {
      sections.push(`### ${api.method} /api/${api.name}`);
      sections.push(``);
      sections.push(`- **ID**: ${api.id}`);
      sections.push(`- **Authentication Required**: ${api.requires_auth || 'No'}`);
      sections.push(`- **User Tier**: ${api.user_tier || 'None'}`);
      if (api.apikeys && api.apikeys.length > 0) {
        sections.push(`- **Required API Keys**: ${api.apikeys.join(', ')}`);
      }
      if (api.returnsRedirect) {
        sections.push(`- **Returns Redirect**: Yes`);
        if (api.redirectCallbackPageId) {
          const callbackPage = blueprint.pages?.find(p => p.id === api.redirectCallbackPageId);
          sections.push(`- **Redirect Callback Page**: ${callbackPage?.name || api.redirectCallbackPageId}`);
        }
      }
      sections.push(``);
      
      // Input parameters
      if (api.input_object_id) {
        const inputObject = blueprint.objects?.find(o => o.id === api.input_object_id);
        if (inputObject) {
          sections.push(`**Input Parameters (${inputObject.name}):**`);
          if (inputObject.description) {
            sections.push(`*${inputObject.description}*`);
          }
          sections.push(``);
          sections.push(generateObjectTable(inputObject, blueprint.objects || []));
        }
      } else {
        sections.push(`**Input Parameters:** None`);
        sections.push(``);
      }
      
      // Output format
      if (api.output_object_id) {
        const outputObject = blueprint.objects?.find(o => o.id === api.output_object_id);
        if (outputObject) {
          sections.push(`**Output Format (${outputObject.name}):**`);
          if (outputObject.description) {
            sections.push(`*${outputObject.description}*`);
          }
          sections.push(``);
          sections.push(generateObjectTable(outputObject, blueprint.objects || []));
        }
      } else if (!api.returnsRedirect) {
        sections.push(`**Output Format:** None`);
        sections.push(``);
      }
      
      if (api.prompt) {
        sections.push(`**Implementation Notes:**`);
        sections.push(`${api.prompt}`);
        sections.push(``);
      }
    }
  } else {
    sections.push(`*No API endpoints defined*`);
    sections.push(``);
  }
  
  // Views Section
  sections.push(`## Views and Components`);
  sections.push(``);
  
  if (blueprint.views && blueprint.views.length > 0) {
    const viewsByType = groupViewsByType(blueprint.views);
    
    for (const [type, views] of Object.entries(viewsByType)) {
      sections.push(`### ${formatViewType(type)}`);
      sections.push(``);
      
      for (const view of views) {
        sections.push(`#### ${view.name}`);
        sections.push(``);
        sections.push(`- **ID**: ${view.id}`);
        sections.push(`- **Type**: ${view.type}`);
        
        if (view.apis && view.apis.length > 0) {
          sections.push(`- **Consumes APIs**:`);
          for (const apiId of view.apis) {
            const api = blueprint.apis?.find(a => a.id === apiId);
            if (api) {
              sections.push(`  - ${api.method} /api/${api.name} (${api.requires_auth ? 'Auth Required' : 'Public'})`);
            } else {
              sections.push(`  - ${apiId}`);
            }
          }
        }
        
        if (view.link_type === 'external' && view.external_url) {
          sections.push(`- **External Link**: ${view.external_url}`);
        }
        
        if (view.custom_view_description) {
          sections.push(``);
          sections.push(`**Description:**`);
          sections.push(`${view.custom_view_description}`);
        }
        
        if (view.subComponents && view.subComponents.length > 0) {
          sections.push(``);
          sections.push(`**Sub-components:**`);
          for (const sub of view.subComponents) {
            sections.push(`- ${sub.name} (${sub.functionName})`);
            if (sub.prompt) {
              sections.push(`  - ${sub.prompt}`);
            }
          }
        }
        
        sections.push(``);
      }
    }
  } else {
    sections.push(`*No views defined*`);
    sections.push(``);
  }
  
  // Data Flow Section
  sections.push(`## Data Flow`);
  sections.push(``);
  sections.push(`### API to View Mapping`);
  sections.push(``);
  
  if (blueprint.apis && blueprint.views) {
    const apiUsage = new Map<string, string[]>();
    
    // Build API usage map
    for (const view of blueprint.views) {
      if (view.apis) {
        for (const apiId of view.apis) {
          if (!apiUsage.has(apiId)) {
            apiUsage.set(apiId, []);
          }
          apiUsage.get(apiId)!.push(view.name);
        }
      }
    }
    
    // Display API usage
    for (const api of blueprint.apis) {
      const views = apiUsage.get(api.id) || [];
      if (views.length > 0) {
        sections.push(`- **${api.method} /api/${api.name}** is used by:`);
        for (const viewName of views) {
          sections.push(`  - ${viewName}`);
        }
        sections.push(``);
      }
    }
    
    // List unused APIs
    const unusedApis = blueprint.apis.filter(api => !apiUsage.has(api.id));
    if (unusedApis.length > 0) {
      sections.push(`### Unused APIs`);
      sections.push(``);
      for (const api of unusedApis) {
        sections.push(`- ${api.method} /api/${api.name}`);
      }
      sections.push(``);
    }
  }
  
  // Pages Section (brief)
  if (blueprint.pages && blueprint.pages.length > 0) {
    sections.push(`### Pages`);
    sections.push(``);
    sections.push(`| Page Name | Access Level | User Tier | Description |`);
    sections.push(`|-----------|--------------|-----------|-------------|`);
    
    for (const page of blueprint.pages) {
      const access = page.access || 'public';
      const tier = page.user_tier || 'all';
      const desc = page.description || '-';
      const homeTag = page.is_home ? ' (Home)' : '';
      sections.push(`| ${page.name}${homeTag} | ${access} | ${tier} | ${desc} |`);
    }
    sections.push(``);
  }
  
  return sections.join('\n');
}

function generateObjectTable(obj: ObjectDefinition, allObjects: ObjectDefinition[]): string {
  const lines: string[] = [];
  
  lines.push(`| Property | Type | Required | Description | Constraints |`);
  lines.push(`|----------|------|----------|-------------|-------------|`);
  
  for (const prop of obj.properties) {
    let displayType: string = prop.type;
    
    if (prop.type === 'object' && prop.object_id) {
      const refObj = allObjects.find(o => o.id === prop.object_id);
      displayType = refObj ? `object (${refObj.name})` : `object (${prop.object_id})`;
    } else if (prop.type === 'array') {
      if (prop.array_item_type === 'object' && prop.array_item_object_id) {
        const refObj = allObjects.find(o => o.id === prop.array_item_object_id);
        displayType = refObj ? `array<${refObj.name}>` : `array<object>`;
      } else {
        displayType = `array<${prop.array_item_type || 'any'}>`;
      }
    }
    
    const constraints = prop.constraints?.join(', ') || '-';
    const description = prop.description || '-';
    
    lines.push(`| ${prop.name} | ${displayType} | ${prop.required ? 'Yes' : 'No'} | ${description} | ${constraints} |`);
  }
  
  lines.push(``);
  
  // If this object references other objects, show their structure too
  for (const prop of obj.properties) {
    if (prop.type === 'object' && prop.object_id) {
      const refObj = allObjects.find(o => o.id === prop.object_id);
      if (refObj && !refObj.created_from_migration) {
        lines.push(`**${prop.name} Structure (${refObj.name}):**`);
        if (refObj.description) {
          lines.push(`*${refObj.description}*`);
        }
        lines.push(``);
        lines.push(generateObjectTable(refObj, allObjects));
      }
    } else if (prop.type === 'array' && prop.array_item_type === 'object' && prop.array_item_object_id) {
      const refObj = allObjects.find(o => o.id === prop.array_item_object_id);
      if (refObj && !refObj.created_from_migration) {
        lines.push(`**${prop.name} Item Structure (${refObj.name}):**`);
        if (refObj.description) {
          lines.push(`*${refObj.description}*`);
        }
        lines.push(``);
        lines.push(generateObjectTable(refObj, allObjects));
      }
    }
  }
  
  return lines.join('\n');
}

function groupViewsByType(views: View[]): Record<string, View[]> {
  const grouped: Record<string, View[]> = {};
  
  for (const view of views) {
    if (!grouped[view.type]) {
      grouped[view.type] = [];
    }
    grouped[view.type].push(view);
  }
  
  return grouped;
}

function formatViewType(type: string): string {
  const typeMap: Record<string, string> = {
    'contact': 'Contact Forms',
    'image': 'Image Sections',
    'container': 'Containers',
    'component': 'Code Sections',
    'generatedcomponent': 'Generated Components',
    'complexcomponent': 'Complex Components',
    'button': 'Buttons',
    'menu': 'Menus',
    'text': 'Text Sections',
    'profile': 'Profile Components',
    'login': 'Login Components',
    'loginbutton': 'Login Buttons',
    'headerlogin': 'Header Login',
    'ctabutton': 'Call to Action Buttons',
    'logo': 'Logos',
    'pricing': 'Pricing Components',
    'integration': 'Integration Sections',
    'logincallback': 'Login Callbacks',
    'youtubevideo': 'YouTube Videos',
    'iconbar': 'Icon Bars',
    'useradmin': 'User Admin',
    'loggedinmenu': 'Logged In Menus',
    'adminmenu': 'Admin Menus'
  };
  
  return typeMap[type] || type;
}
