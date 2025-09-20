const parser = require('@babel/parser');
const generator = require('@babel/generator').default;
const t = require('@babel/types');
const fs = require('fs');

// @ts-ignore
const traverse = require('@babel/traverse').default;

/**
 * @typedef {Object} TranspilerOptions
 * @property {boolean} [convertReactCreateElement]
 * @property {boolean} [convertWindowPostMessage]
 * @property {boolean} [convertReactHooks]
 * @property {boolean} [removeEventListenerCleanup]
 */

/**
 * Adds React import if needed
 * @param {Object} ast - The AST to modify
 */
function addReactImport(ast) {
  const hasReactImport = ast.program.body.some(node => 
    node.type === 'ImportDeclaration' && 
    node.source.value === 'react'
  );
  
  if (!hasReactImport) {
    const importDeclaration = t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier('React')), 
       t.importSpecifier(t.identifier('useState'), t.identifier('useState')),
       t.importSpecifier(t.identifier('useEffect'), t.identifier('useEffect')),
       t.importSpecifier(t.identifier('useMemo'), t.identifier('useMemo')),
       t.importSpecifier(t.identifier('useCallback'), t.identifier('useCallback')),
       t.importSpecifier(t.identifier('useRef'), t.identifier('useRef')),
       t.importSpecifier(t.identifier('useContext'), t.identifier('useContext'))],
      t.stringLiteral('react')
    );
    
    ast.program.body.unshift(importDeclaration);
  }
}

/**
 * Adds Next.js router import if needed
 * @param {Object} ast - The AST to modify
 */
function addRouterImport(ast) {
  const hasRouterImport = ast.program.body.some(node => 
    node.type === 'ImportDeclaration' && 
    node.source.value === 'next/navigation' &&
    node.specifiers.some(spec => 
      spec.type === 'ImportSpecifier' && 
      spec.imported.name === 'useRouter'
    )
  );
  
  if (!hasRouterImport) {
    const importDeclaration = t.importDeclaration(
      [t.importSpecifier(t.identifier('useRouter'), t.identifier('useRouter'))],
      t.stringLiteral('next/navigation')
    );
    
    ast.program.body.unshift(importDeclaration);
  }
}

/**
 * Adds router initialization to the component function
 * @param {Object} ast - The AST to modify
 */
function addRouterInitialization(ast) {
  traverse(ast, {
    FunctionDeclaration(path) {
      // Check if this is the main component function (should be the default export)
      if (path.parent && path.parent.type === 'ExportDefaultDeclaration') {
        // Check if router is already initialized
        const hasRouter = path.scope.bindings.router !== undefined;
        
        if (!hasRouter) {
          // Create router initialization statement
          const routerInit = t.variableDeclaration('const', [
            t.variableDeclarator(
              t.identifier('router'),
              t.callExpression(t.identifier('useRouter'), [])
            )
          ]);
          
          // Add it to the beginning of the function body
          path.get('body').unshiftContainer('body', routerInit);
        }
      }
    }
  });
}
/**
 * Converts React hooks (React.useState to useState, etc.)
 * @param {Object} path - The AST path
 */
function convertReactHooks(path) {
  if (path.node.object && path.node.object.type === 'Identifier' &&
      path.node.object.name === 'React' &&
      path.node.property && path.node.property.type === 'Identifier' &&
      ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext'].includes(path.node.property.name)) {
    
    path.replaceWith(t.identifier(path.node.property.name));
  }
}

/**
 * Converts React.createElement calls to JSX
 * @param {Object} path - The AST path
 */
function convertReactCreateElement(path) {
  if (path.node.callee && path.node.callee.type === 'MemberExpression' &&
      path.node.callee.object && path.node.callee.object.type === 'Identifier' &&
      path.node.callee.object.name === 'React' &&
      path.node.callee.property && path.node.callee.property.type === 'Identifier' &&
      path.node.callee.property.name === 'createElement') {
    
    const [elementType, props, ...children] = path.node.arguments;
    
    if (!elementType) return;
    
    // Create the opening element
    let jElement = null;
    if (elementType.type === 'StringLiteral') {
      jElement = t.jsxIdentifier(elementType.value);
    } else if (elementType.type === 'Identifier') {
      jElement = t.jsxIdentifier(elementType.name);
    } else if (elementType.type === 'MemberExpression') {
      // Assuming a simple MemberExpression like React.Fragment
      jElement = t.jsxMemberExpression(
        t.jsxIdentifier(elementType.object.name),
        t.jsxIdentifier(elementType.property.name)
      );
    } else {
      throw new Error('Unsupported element type in React.createElement');
    }

    const openingElement = t.jsxOpeningElement(
      jElement,
      [],
      children.length === 0
    );
    
    // Add props to the opening element
    if (props && props.type === 'ObjectExpression') {
      let hasKeyProp = false;
      
      props.properties.forEach((prop) => {
        if (prop.type === 'ObjectProperty') {
          const name = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
          
          // Check if key prop exists
          if (name === 'key') {
            hasKeyProp = true;
          }
          
          // Handle className specially
          if (name === 'className' && prop.value.type === 'StringLiteral') {
            openingElement.attributes.push(
              t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(prop.value.value))
            );
          } 
          // Handle event handlers (onClick, etc.)
          else if (name.startsWith('on') && prop.value.type === 'ArrowFunctionExpression') {
            openingElement.attributes.push(
              t.jsxAttribute(t.jsxIdentifier(name), t.jsxExpressionContainer(prop.value))
            );
          }
          // Handle string literals directly without wrapping in expression containers
          else if (prop.value.type === 'StringLiteral') {
            openingElement.attributes.push(
              t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(prop.value.value))
            );
          }
          // Handle other props
          else {
            openingElement.attributes.push(
              t.jsxAttribute(t.jsxIdentifier(name), t.jsxExpressionContainer(prop.value))
            );
          }
        }
      });
      
      // If we're in an array context and no key prop exists, try to add one
      if (!hasKeyProp && path.parent && 
          (path.parent.type === 'ArrayExpression' || 
           (path.parent.type === 'CallExpression' && 
            path.parent.callee && 
            path.parent.callee.type === 'MemberExpression' && 
            path.parent.callee.property && 
            path.parent.callee.property.name === 'map'))) {
        // Add index as key if we're in a map function
        if (path.scope.hasBinding('index')) {
          openingElement.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier('key'),
              t.jsxExpressionContainer(t.identifier('index'))
            )
          );
        }
      }
    }
    
    // Create the closing element if needed
    let closingElement = null;
    if (children.length > 0) {
      if (elementType.type === 'StringLiteral') {
        closingElement = t.jsxClosingElement(t.jsxIdentifier(elementType.value));
      } else if (elementType.type === 'Identifier') {
        closingElement = t.jsxClosingElement(t.jsxIdentifier(elementType.name));
      } else if (elementType.type === 'MemberExpression') {
        // Assuming a simple MemberExpression like React.Fragment
        closingElement = t.jsxClosingElement(
          t.jsxMemberExpression(
            t.jsxIdentifier(elementType.object.name),
            t.jsxIdentifier(elementType.property.name)
          )
        );
      } else {
        throw new Error('Unsupported element type in React.createElement');
      }
    }
    
    // Process children
    const jsxChildren = [];
    
    // Handle array of children - don't wrap them in additional expression containers
    if (children.length === 1 && children[0].type === 'ArrayExpression') {
      children[0].elements.forEach(child => {
        if (child.type === 'StringLiteral') {
          jsxChildren.push(t.jsxText(child.value));
        } else if (child.type === 'CallExpression' && 
                  child.callee && child.callee.type === 'MemberExpression' && 
                  child.callee.object && child.callee.object.name === 'React' && 
                  child.callee.property && child.callee.property.name === 'createElement') {
          // For nested React.createElement calls, we need to recursively transform them
          const nestedJsxElement = convertReactCreateElementToJSX(child);
          jsxChildren.push(nestedJsxElement);
        } else if (child.type === 'LogicalExpression' && child.operator === '&&') {
          // Handle conditional rendering with && operator
          jsxChildren.push(t.jsxExpressionContainer(child));
        } else if (child.type === 'SpreadElement') {
          // Handle spread elements - wrap the argument in expression container
          jsxChildren.push(t.jsxExpressionContainer(child.argument));
        } else {
          // Debug: Log unexpected child types for future debugging
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Transpiler Debug] Processing array child type: ${child.type}`);
          }
          jsxChildren.push(t.jsxExpressionContainer(child));
        }
      });
    } else {
      // Handle individual children
      children.forEach(child => {
        if (child.type === 'StringLiteral') {
          jsxChildren.push(t.jsxText(child.value));
        } else if (child.type === 'CallExpression' && 
                  child.callee && child.callee.type === 'MemberExpression' && 
                  child.callee.object && child.callee.object.name === 'React' && 
                  child.callee.property && child.callee.property.name === 'createElement') {
          // For nested React.createElement calls, we need to recursively transform them
          const nestedJsxElement = convertReactCreateElementToJSX(child);
          jsxChildren.push(nestedJsxElement);
        } else if (child.type === 'LogicalExpression' && child.operator === '&&') {
          // Handle conditional rendering with && operator
          jsxChildren.push(t.jsxExpressionContainer(child));
        } else if (child.type === 'SpreadElement') {
          // Handle spread elements - wrap the argument in expression container
          jsxChildren.push(t.jsxExpressionContainer(child.argument));
        } else {
          // Debug: Log unexpected child types for future debugging
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[Transpiler Debug] Processing individual child type: ${child.type}`);
          }
          jsxChildren.push(t.jsxExpressionContainer(child));
        }
      });
    }
    
    // Create the JSX element
    const jsxElement = t.jsxElement(
      openingElement,
      closingElement,
      jsxChildren,
      children.length === 0
    );
    
    path.replaceWith(jsxElement);
  }
}

/**
 * Helper function to convert React.createElement to JSX without modifying the AST
 * This is used for nested createElement calls
 */
function convertReactCreateElementToJSX(node) {
  if (!node.callee || node.callee.type !== 'MemberExpression' ||
      !node.callee.object || node.callee.object.type !== 'Identifier' ||
      node.callee.object.name !== 'React' ||
      !node.callee.property || node.callee.property.type !== 'Identifier' ||
      node.callee.property.name !== 'createElement') {
    return t.jsxExpressionContainer(node);
  }
  
  const [elementType, props, ...children] = node.arguments;
  
  if (!elementType) return t.jsxExpressionContainer(node);
  
  // Create the opening element
  let jElement = null;
  if (elementType.type === 'StringLiteral') {
    jElement = t.jsxIdentifier(elementType.value);
  } else if (elementType.type === 'Identifier') {
    jElement = t.jsxIdentifier(elementType.name);
  } else if (elementType.type === 'MemberExpression') {
    jElement = t.jsxMemberExpression(
      t.jsxIdentifier(elementType.object.name),
      t.jsxIdentifier(elementType.property.name)
    );
  } else {
    return t.jsxExpressionContainer(node);
  }

  const openingElement = t.jsxOpeningElement(
    jElement,
    [],
    children.length === 0
  );
  
  // Add props to the opening element
  if (props && props.type === 'ObjectExpression') {
    props.properties.forEach((prop) => {
      if (prop.type === 'ObjectProperty') {
        const name = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
        
        // Handle className specially
        if (name === 'className' && prop.value.type === 'StringLiteral') {
          openingElement.attributes.push(
            t.jsxAttribute(t.jsxIdentifier('className'), t.stringLiteral(prop.value.value))
          );
        } 
        // Handle string literals directly without wrapping in expression containers
        else if (prop.value.type === 'StringLiteral') {
          openingElement.attributes.push(
            t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(prop.value.value))
          );
        }
        // Handle other props
        else {
          openingElement.attributes.push(
            t.jsxAttribute(t.jsxIdentifier(name), t.jsxExpressionContainer(prop.value))
          );
        }
      }
    });
  }
  
  // Create the closing element if needed
  let closingElement = null;
  if (children.length > 0) {
    if (elementType.type === 'StringLiteral') {
      closingElement = t.jsxClosingElement(t.jsxIdentifier(elementType.value));
    } else if (elementType.type === 'Identifier') {
      closingElement = t.jsxClosingElement(t.jsxIdentifier(elementType.name));
    } else if (elementType.type === 'MemberExpression') {
      closingElement = t.jsxClosingElement(
        t.jsxMemberExpression(
          t.jsxIdentifier(elementType.object.name),
          t.jsxIdentifier(elementType.property.name)
        )
      );
    } else {
      return t.jsxExpressionContainer(node);
    }
  }
  
  // Process children
  const jsxChildren = [];
  
  // Handle array of children - don't wrap them in additional expression containers
  if (children.length === 1 && children[0].type === 'ArrayExpression') {
    children[0].elements.forEach(child => {
      if (!child) return; // Skip null or undefined elements
      
      if (child.type === 'StringLiteral') {
        jsxChildren.push(t.jsxText(child.value));
      } else if (child.type === 'CallExpression' && 
                child.callee && child.callee.type === 'MemberExpression' && 
                child.callee.object && child.callee.object.name === 'React' && 
                child.callee.property && child.callee.property.name === 'createElement') {
        // Recursively handle nested createElement calls
        jsxChildren.push(convertReactCreateElementToJSX(child));
      } else if (child.type === 'LogicalExpression' && child.operator === '&&') {
        // Handle conditional rendering with && operator
        jsxChildren.push(t.jsxExpressionContainer(child));
      } else if (child.type === 'SpreadElement') {
        // Handle spread elements by converting them to regular expressions
        jsxChildren.push(t.jsxExpressionContainer(child.argument));
      } else {
        jsxChildren.push(t.jsxExpressionContainer(child));
      }
    });
  } else {
    // Handle individual children
    children.forEach(child => {
      if (!child) return; // Skip null or undefined children
      
      if (child.type === 'StringLiteral') {
        jsxChildren.push(t.jsxText(child.value));
      } else if (child.type === 'CallExpression' && 
                child.callee && child.callee.type === 'MemberExpression' && 
                child.callee.object && child.callee.object.name === 'React' && 
                child.callee.property && child.callee.property.name === 'createElement') {
        // Recursively handle nested createElement calls
        jsxChildren.push(convertReactCreateElementToJSX(child));
      } else if (child.type === 'LogicalExpression' && child.operator === '&&') {
        // Handle conditional rendering with && operator
        jsxChildren.push(t.jsxExpressionContainer(child));
      } else if (child.type === 'SpreadElement') {
        // Handle spread elements by converting them to regular expressions
        jsxChildren.push(t.jsxExpressionContainer(child.argument));
      } else {
        jsxChildren.push(t.jsxExpressionContainer(child));
      }
    });
  }
  
  // Create the JSX element
  return t.jsxElement(
    openingElement,
    closingElement,
    jsxChildren,
    children.length === 0
  );
}
/**
 * Converts window.postMessage navigation to router.push
 * @param {Object} path - The AST path
 */
function convertWindowPostMessage(path, pages) {
  // Check if we have a window.postMessage call
  if (!path.node.callee || path.node.callee.type !== 'MemberExpression') return;
  
  const callee = path.node.callee;
  const isWindowObject = 
    (callee.object.type === 'MemberExpression' && 
     callee.object.object && 
     callee.object.object.name === 'window') ||
    (callee.object.type === 'Identifier' && 
     callee.object.name === 'window');
  
  const isPostMessageMethod = 
    callee.property && 
    callee.property.type === 'Identifier' && 
    callee.property.name === 'postMessage';
  
  if (!isWindowObject || !isPostMessageMethod || path.node.arguments.length < 1) return;
  
  const messageArg = path.node.arguments[0];
  
  // Check if this is a navigation message
  if (messageArg.type !== 'ObjectExpression') return;
  
  const navigateProperty = messageArg.properties.find(
    prop => prop.type === 'ObjectProperty' && 
            prop.key && 
            prop.key.type === 'StringLiteral' && 
            prop.key.value === 'navigate'
  ) || messageArg.properties.find(
    prop => prop.type === 'ObjectProperty' && 
            prop.key && 
            prop.key.type === 'Identifier' && 
            prop.key.name === 'navigate'
  );
  
  if (!navigateProperty) return;
  
  const idsProperty = messageArg.properties.find(
    prop => prop.type === 'ObjectProperty' && 
            prop.key && 
            ((prop.key.type === 'Identifier' && prop.key.name === 'ids') ||
             (prop.key.type === 'StringLiteral' && prop.key.value === 'ids'))
  );
  
  // Get the page ID from the navigate property
  const pageId = navigateProperty.value.type === 'StringLiteral' 
    ? navigateProperty.value.value 
    : null;
  
  if (!pageId) return;
  
  let routeExpression;
  
  if (idsProperty && idsProperty.value && idsProperty.value.type === 'ArrayExpression' && 
      idsProperty.value.elements.length > 0) {
    // Handle query parameters
    const expressions = [];
    const parts = [];
    
    // Start with the base path
    parts.push(`/${pageNameLookup(pages, pageId)}?`);
    
    idsProperty.value.elements.forEach((idObj, index) => {
      if (idObj && idObj.type === 'ObjectExpression') {
        idObj.properties.forEach((prop, propIndex) => {
          if (prop.type === 'ObjectProperty' && prop.key) {
            const paramName = prop.key.type === 'Identifier' 
              ? prop.key.name 
              : (prop.key.type === 'StringLiteral' ? prop.key.value : null);
            
            if (paramName && prop.value) {
              // Add separator if not the first parameter
              if (index > 0 || propIndex > 0) {
                parts[parts.length - 1] += '&';
              }
              
              // Add parameter name to the current part
              parts[parts.length - 1] += `${paramName}=`;
              
              // Add the expression
              expressions.push(prop.value);
              
              // Add a new part for after this expression
              parts.push('');
            }
          }
        });
      }
    });
    
    if (expressions.length > 0) {
      // Create template literal parts
      // The number of quasis should be exactly one more than the number of expressions
      const quasis = parts.map((part, i) => 
        t.templateElement({ raw: part, cooked: part }, i === parts.length - 1)
      );
      
      // Create the template literal
      routeExpression = t.templateLiteral(quasis, expressions);
    } else {
      routeExpression = t.stringLiteral(`/${pageNameLookup(pages, pageId)}`);
    }
  } else {
    // Simple route without params
    routeExpression = t.stringLiteral(`/${pageNameLookup(pages, pageId)}`);
  }
  
  // Replace with router.push
  path.replaceWith(
    t.callExpression(
      t.memberExpression(t.identifier('router'), t.identifier('push')),
      [routeExpression]
    )
  );
}

function pageNameLookup(pages, pageId) {
  for (const page of pages) {
    if (page.id === pageId) {
      // Always use page name for URL navigation, never page ID
      return page.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
    }
  }
}
/**
 * Removes all comments from the code
 * @param {string} code - The source code with comments
 * @returns {string} - The code with comments removed
 */
function removeComments(code) {
  // Remove single-line comments
  code = code.replace(/\/\/.*$/gm, '');
  
  // Remove multi-line comments
  code = code.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove empty lines that might result from comment removal
  code = code.replace(/^\s*[\r\n]/gm, '');
  
  return code;
}

/**
 * Transpiles the provided code
 * @param {string} code - The source code to transpile
 * @param {Array} pages - Array of pages for navigation references
 * @returns {string} - The transpiled code
 */
function transpileCode(code, pages, dictionary = {}) {

  try {

    code = code.replace(/https:\/\//g, '[httpsstart]').replace(/http:\/\//g, '[httpstart]');

    // Replace any < or > inside quotes with &lt; and &gt;
    code = code.replace(/(['"])((?:\\.|(?!\1).)*?)\1/g, function(match, quote, inner) {
      return quote + inner.replace(/</g, '&lt;').replace(/>/g, '&gt;') + quote;
    });
    
    // First handle template literals - these shouldn't be sent by frontend, so remove them entirely
    // Match window.processText with template literal first parameter and any optional second parameter
    code = code.replace(/window\.processText\(\s*`[^`]*`\s*(?:,\s*[^)]+)?\s*\)/g, function(match) {
      // Frontend shouldn't send template literals, return empty string
      return '""';
    });

    // Then handle static strings - window.processText calls with actual text content from dictionary
    // Handle both single parameter: window.processText("key") 
    // and two parameter: window.processText("key", "default") formats
    code = code.replace(/window\.processText\(\s*["'`]([^"'`]+)["'`]\s*(?:,\s*["'`]([^"'`]*)["'`])?\s*\)/g, function(match, dictionaryId, defaultText) {
      // Skip if this contains template literal syntax (shouldn't happen after first pass, but be safe)
      if (dictionaryId.includes('${')) {
        return match;
      }
      
      // Try lowercase version of the key first (system expects lowercase keys)
      const lowercaseId = dictionaryId.toLowerCase();
      const textContent = dictionary[lowercaseId] || dictionary[dictionaryId];
      let finalText;
      
      if (textContent !== undefined) {
        // Use dictionary value if found
        finalText = textContent;
       } else if (defaultText !== undefined) {
        // Use default text if dictionary key not found but default provided
        finalText = defaultText;

      } else {
        // No dictionary value and no default - remove the window.processText call entirely
        // Return empty string to remove it from the output
        return '""';
      }
      
      // Escape the text content for safe inclusion in JavaScript
      return JSON.stringify(finalText);
    });
    
    // Replace window.fetchTest with standard fetch
    code = code.replace(/window\.fetchTest/g, "fetch");
    
    code = code.replace(/window.location.search/g, "typeof(window)!=='undefined' ? window.location.search : ''");

    code = code.replace(/localStorage.getItem/g, "typeof(localStorage)==='undefined' ? '' : localStorage.getItem");

    code = code.replace(/localStorage.setItem/g, "if (typeof(localStorage)!=='undefined') localStorage.setItem");

    // Remove comments from the code
    code = removeComments(code);
    
    // Replace the first occurrence of "function" with "export default function" and remove any parent window references
    code = code.replace(/function/, 'export default function').replace(/parent\.window/g, "window");

    // Parse the code into an AST
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // Add React import if needed
    addReactImport(ast);

    // Flag to track if we need to add router imports
    let needsRouter = false;

    // First pass to check if we need router
    traverse(ast, {
      CallExpression(path) {
        if (path.node.callee && 
            path.node.callee.type === 'MemberExpression' &&
            ((path.node.callee.object.type === 'Identifier' && path.node.callee.object.name === 'window') ||
             (path.node.callee.object.type === 'MemberExpression' && path.node.callee.object.object && 
              path.node.callee.object.object.name === 'window')) &&
            path.node.callee.property && 
            path.node.callee.property.name === 'postMessage') {
          
          // Check if this is a navigation message
          const messageArg = path.node.arguments[0];
          if (messageArg && messageArg.type === 'ObjectExpression') {
            const navigateProperty = messageArg.properties.find(
              prop => prop.type === 'ObjectProperty' && 
                      prop.key && 
                      ((prop.key.type === 'StringLiteral' && prop.key.value === 'navigate') ||
                       (prop.key.type === 'Identifier' && prop.key.name === 'navigate'))
            );
            
            if (navigateProperty) {
              needsRouter = true;
            }
          }
        }
      }
    });

    // Add router import if needed
    if (needsRouter) {
      addRouterImport(ast);
      addRouterInitialization(ast);
    }

    // Transform the AST
    traverse(ast, {
      MemberExpression(path) {
        // Convert React.useState to useState
        convertReactHooks(path);
      },
      
      CallExpression(path) {
        // Convert React.createElement to JSX
        convertReactCreateElement(path);
        
        // Convert window.postMessage navigation to router.push
        convertWindowPostMessage(path, pages);
      }
    });

    // Generate the transformed code
    const output = generator(ast, {
      retainLines: false,
      compact: false,
      jsescOption: {
        quotes: 'single',
      },
    });
    
    return JSON.stringify({ success: true, code: "'use client';\n\n" + output.code.replace(/\[httpsstart\]/g, 'https://').replace(/\[httpstart\]/g, 'http://') });
  } catch (error) {
    console.error('Transpilation error:', error);
    return JSON.stringify({ success: false, error: JSON.stringify(error) }); // Return original code if transpilation fails
  }
}
// Main function to run the transpiler
function main() {
  // Test input string - replace this with your code to test
  const inputString = `   function BookmarkedJobsList() {
  const [bookmarks, setBookmarks] = React.useState([]);
  const [jobs, setJobs] = React.useState({});
  const [companies, setCompanies] = React.useState({});
  const [jobCategories, setJobCategories] = React.useState([]);
  const [jobTypes, setJobTypes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filters, setFilters] = React.useState({
    categoryId: "",
    jobTypeId: "",
    dateRange: ""
  });
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [currentBookmark, setCurrentBookmark] = React.useState(null);
  const [editNotes, setEditNotes] = React.useState("");

  // Load all bookmarked jobs
  React.useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        setLoading(true);
        // Get all bookmarks for the current user
        const bookmarksResponse = await fetch('/api/jobbookmarks');
        if (!bookmarksResponse.ok) {
          throw new Error('Failed to fetch bookmarks');
        }
        const bookmarksData = await bookmarksResponse.json();
        setBookmarks(bookmarksData);

        // Get all job IDs from bookmarks
        const jobIds = bookmarksData.map(bookmark => bookmark.JobsID);
        if (jobIds.length > 0) {
          const jobsResponse = await fetch('/api/jobs?');
          if (!jobsResponse.ok) {
            throw new Error('Failed to fetch jobs');
          }
          const jobsData = await jobsResponse.json();
          
          // Convert jobs array to object with ID as key for easier lookup
          const jobsObj = {};
          jobsData.forEach(job => {
            jobsObj[job.ID] = job;
          });
          setJobs(jobsObj);

          // Get all company IDs from jobs
          const companyIds = jobsData.map(job => job.CompaniesID);
          if (companyIds.length > 0) {
            const companiesResponse = await fetch('/api/companies?ID=');
            if (companiesResponse.ok) {
              const companiesData = await companiesResponse.json();
              // Convert companies array to object with ID as key
              const companiesObj = {};
              companiesData.forEach(company => {
                companiesObj[company.ID] = company;
              });
              setCompanies(companiesObj);
            }
          }
        }

        // Get job categories and job types for filtering
        const categoriesResponse = await fetch('/api/jobcategories');
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          setJobCategories(categoriesData);
        }

        const typesResponse = await fetch('/api/jobtypes');
        if (typesResponse.ok) {
          const typesData = await typesResponse.json();
          setJobTypes(typesData);
        }

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchBookmarks();
  }, []);

  // Handle removing a bookmark
  const handleRemoveBookmark = async (bookmarkId) => {
    try {
      const response = await fetch('/api/jobbookmarks/', {
        method: 'DELETE'
      });

      if (response.ok) {
        // Update local state by removing the deleted bookmark
        setBookmarks(bookmarks.filter(bookmark => bookmark.ID !== bookmarkId));
      } else {
        throw new Error('Failed to remove bookmark');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle opening edit notes modal
  const handleEditNotes = (bookmark) => {
    setCurrentBookmark(bookmark);
    setEditNotes(bookmark.notes || "");
    setEditModalOpen(true);
  };

  // Handle saving notes
  const handleSaveNotes = async () => {
    try {
      const updatedBookmark = {
        ...currentBookmark,
        notes: editNotes
      };

      const response = await fetch('/api/jobbookmarks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedBookmark)
      });

      if (response.ok) {
        // Update local state with the edited notes
        setBookmarks(bookmarks.map(bookmark => 
          bookmark.ID === currentBookmark.ID ? {...bookmark, notes: editNotes} : bookmark
        ));
        setEditModalOpen(false);
      } else {
        throw new Error('Failed to update notes');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle view job details
  const handleViewJobDetails = (jobId) => {
    window.postMessage(
      { 
        navigate: "7b93cab2-5e74-4356-bc10-f9f615e9b95e", 
        ids: [{ JobsID: jobId }]
      }, 
      "*"
    );
  };

  // Handle search and filter
  const filteredBookmarks = React.useMemo(() => {
    return bookmarks.filter(bookmark => {
      const job = jobs[bookmark.JobsID];
      if (!job) return false;
      
      // Apply search term filter
      const searchTermMatch = searchTerm === "" || 
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (companies[job.CompaniesID]?.name && companies[job.CompaniesID].name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (bookmark.notes && bookmark.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Apply category filter
      const categoryMatch = filters.categoryId === "" || job.JobCategoriesID === filters.categoryId;
      
      // Apply job type filter
      const jobTypeMatch = filters.jobTypeId === "" || job.JobTypesID === filters.jobTypeId;
      
      // Apply date filter
      let dateMatch = true;
      if (filters.dateRange !== "") {
        const bookmarkDate = new Date(bookmark.created_at);
        const today = new Date();
        const pastDate = new Date();
        
        switch(filters.dateRange) {
          case "last7days":
            pastDate.setDate(today.getDate() - 7);
            dateMatch = bookmarkDate >= pastDate;
            break;
          case "last30days":
            pastDate.setDate(today.getDate() - 30);
            dateMatch = bookmarkDate >= pastDate;
            break;
          case "last90days":
            pastDate.setDate(today.getDate() - 90);
            dateMatch = bookmarkDate >= pastDate;
            break;
        }
      }
      
      return searchTermMatch && categoryMatch && jobTypeMatch && dateMatch;
    });
  }, [bookmarks, jobs, companies, searchTerm, filters]);

  // Format date for display
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (loading) {
    return React.createElement('div', { className: 'p-4 text-center' }, 'Loading bookmarks...');
  }

  if (error) {
    return React.createElement('div', { className: 'p-4 text-center' }, 'Error:');
  }

  return React.createElement('div', { className: 'container mx-auto p-4' }, [
    // Header
    React.createElement('h1', { className: 'mb-6' }, 'My Bookmarked Jobs'),
    
    // Search and filters
    React.createElement('div', { className: 'mb-6 p-4 border rounded' }, [
      // Search input
      React.createElement('div', { className: 'mb-4' }, [
        React.createElement('input', {
          type: 'text',
          placeholder: 'Search bookmarks...',
          className: 'w-full p-2 border rounded',
          value: searchTerm,
          onChange: (e) => setSearchTerm(e.target.value)
        })
      ]),
      
      // Filters
      React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' }, [
        // Category filter
        React.createElement('div', {}, [
          React.createElement('label', { className: 'block mb-1' }, 'Job Category'),
          React.createElement('select', {
            className: 'w-full p-2 border rounded',
            value: filters.categoryId,
            onChange: (e) => setFilters({...filters, categoryId: e.target.value})
          }, [
            React.createElement('option', { value: '' }, 'All Categories'),
            ...jobCategories.map(category => 
              React.createElement('option', { key: category.ID, value: category.ID }, category.name)
            )
          ])
        ]),
        
        // Job Type filter
        React.createElement('div', {}, [
          React.createElement('label', { className: 'block mb-1' }, 'Job Type'),
          React.createElement('select', {
            className: 'w-full p-2 border rounded',
            value: filters.jobTypeId,
            onChange: (e) => setFilters({...filters, jobTypeId: e.target.value})
          }, [
            React.createElement('option', { value: '' }, 'All Types'),
            ...jobTypes.map(type => 
              React.createElement('option', { key: type.ID, value: type.ID }, type.name)
            )
          ])
        ]),
        
        // Date filter
        React.createElement('div', {}, [
          React.createElement('label', { className: 'block mb-1' }, 'Date Bookmarked'),
          React.createElement('select', {
            className: 'w-full p-2 border rounded',
            value: filters.dateRange,
            onChange: (e) => setFilters({...filters, dateRange: e.target.value})
          }, [
            React.createElement('option', { value: '' }, 'All Time'),
            React.createElement('option', { value: 'last7days' }, 'Last 7 Days'),
            React.createElement('option', { value: 'last30days' }, 'Last 30 Days'),
            React.createElement('option', { value: 'last90days' }, 'Last 90 Days')
          ])
        ])
      ])
    ]),
    
    // Bookmarks list
    React.createElement('div', { className: 'mb-4' }, [
      filteredBookmarks.length === 0 
        ? React.createElement('div', { className: 'text-center p-4 border rounded' }, 'No bookmarked jobs found.')
        : React.createElement('div', { className: 'grid grid-cols-1 gap-4' }, 
            filteredBookmarks.map(bookmark => {
              const job = jobs[bookmark.JobsID];
              const company = job ? companies[job.CompaniesID] : null;
              
              if (!job) return null;
              
              return React.createElement('div', { 
                key: bookmark.ID, 
                className: 'border rounded p-4'
              }, [
                // Job title and actions
                React.createElement('div', { className: 'flex justify-between items-start mb-2' }, [
                  React.createElement('h2', { className: 'text-xl' }, job.title),
                  React.createElement('div', { className: 'flex space-x-2' }, [
                    // View details button
                    React.createElement('button', {
                      className: 'p-2 border rounded',
                      onClick: () => handleViewJobDetails(job.ID)
                    }, 'View Details'),
                    
                    // Edit notes button
                    React.createElement('button', {
                      className: 'p-2 border rounded',
                      onClick: () => handleEditNotes(bookmark)
                    }, 'Edit Notes'),
                    
                    // Remove bookmark button
                    React.createElement('button', {
                      className: 'p-2 border rounded',
                      onClick: () => handleRemoveBookmark(bookmark.ID)
                    }, 'Remove')
                  ])
                ]),
                
                // Job details
                React.createElement('div', { className: 'mb-2' }, [
                  company && React.createElement('div', { className: 'mb-1' }, 'Company:'),
                  job.location && React.createElement('div', { className: 'mb-1' }, 'Location:'),
                  job.JobTypesID && jobTypes.find(t => t.ID === job.JobTypesID) &&  
                    React.createElement('div', { className: 'mb-1' }, 'Job Type:'),
                  React.createElement('div', { className: 'mb-1' }, 'Bookmarked on:')
                ]),
                
                // Notes section
                bookmark.notes && React.createElement('div', { className: 'mt-2 p-2 border-t' }, [
                  React.createElement('div', { className: 'font-semibold' }, 'Notes:'),
                  React.createElement('div', {}, bookmark.notes)
                ])
              ]);
            })
          )
    ]),
    
    // Edit Notes Modal
    editModalOpen && React.createElement('div', { 
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4'
    }, 
      React.createElement('div', { className: 'bg-white p-6 rounded max-w-lg w-full' }, [
        React.createElement('h2', { className: 'text-xl mb-4' }, 'Edit Notes'),
        React.createElement('textarea', {
          className: 'w-full p-2 border rounded mb-4',
          rows: 5,
          value: editNotes,
          onChange: (e) => setEditNotes(e.target.value)
        }),
        React.createElement('div', { className: 'flex justify-end space-x-2' }, [
          React.createElement('button', {
            className: 'p-2 border rounded',
            onClick: () => setEditModalOpen(false)
          }, 'Cancel'),
          React.createElement('button', {
            className: 'p-2 border rounded',
            onClick: handleSaveNotes
          }, 'Save')
        ])
      ])
    )
  ]);
}`;
  
  try {

    const transpiled = transpileCode(inputString, []);
    console.log(transpiled);
  } catch (error) {
    console.error('Error during transpilation:', error);
    process.exit(1);
  }
}

// Run the transpiler if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { transpileCode };
