import { Menu, Page } from "../types.js";

export function generateMenuViewCode(
  componentName: string,
  menuId: string | undefined,
  menus: Menu[],
  pages: Page[]
): string {
  const menu = menus.find((m) => m.id === menuId) ?? null;
  const pagesData = pages.map((p) => ({ id: p.id, name: p.name }));
  
  return `import React from 'react';
import WrappedMenu from '../components/wrapped_menu';
const menuData = ${JSON.stringify(menu ?? {})};
const pagesData = ${JSON.stringify(pagesData)};
export default function ${componentName}(){return <WrappedMenu menu={menuData as any} pages={pagesData as any} />}`;
}
