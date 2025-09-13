export function generateMenuViewCode(componentName, menuId, menus, pages) {
    const menu = menus.find((m) => m.id === menuId) ?? null;
    const pagesData = pages.map((p) => ({ id: p.id, name: p.name }));
    return `import React from 'react';
import WrappedMenu from '../components/wrapped_menu';
const menuData = ${JSON.stringify(menu ?? {})};
const pagesData = ${JSON.stringify(pagesData)};
export default function ${componentName}(){return <WrappedMenu menu={menuData as any} pages={pagesData as any} />}`;
}
//# sourceMappingURL=menus.js.map