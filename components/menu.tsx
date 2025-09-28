/* 
Sitepaige Components v1.0.0
Sitepaige components are automatically added to your project the first time it is built, and are only added again if the "Build Components" button is 
checked in the system build settings. It is safe to modify this file without it being overwritten unless that setting is selected. 
*/

'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface Menu {
  id: string;
  name: string;
  font: string;
  fontSize: string;
  untouchable: boolean;
  direction: string | null;
  align?: string | null;
  items: Array<MenuItem>;
}

interface MenuItem {
  id: string;
  name: string;
  page: string | null;
  menu: string | null;
  untouchable: boolean;
  link_type?: 'page' | 'external';
  external_url?: string | null;
  hiddenOnDesktop?: boolean; // New field to hide item on desktop (shows in icon bar instead)
}

interface MenuProps {
  menu?: Menu;
  onClick?: () => void;
  pages?: Array<{id: string, name: string}>; // For resolving page links
}

// Simple hamburger and close icons using CSS
const HamburgerIcon = () => (
  <div className="w-6 h-6 flex flex-col justify-center items-center">
    <div className="w-5 h-0.5 bg-current mb-1"></div>
    <div className="w-5 h-0.5 bg-current mb-1"></div>
    <div className="w-5 h-0.5 bg-current"></div>
  </div>
);

const CloseIcon = () => (
  <div className="w-6 h-6 flex justify-center items-center relative">
    <div className="w-5 h-0.5 bg-current absolute transform rotate-45"></div>
    <div className="w-5 h-0.5 bg-current absolute transform -rotate-45"></div>
  </div>
);

export default function Menu({ menu, onClick, pages = [] }: MenuProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle case where menu is undefined/null
  if (!menu) {
    return null;
  }

  // Check if menu has items
  if (!menu.items || menu.items.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Menu has no items to display
      </div>
    );
  }

  // Mobile detection with proper SSR handling
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 800);
    };
    
    // Check on mount
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const direction = menu.direction === 'vertical' ? 'vertical' : 'horizontal';

  const renderMenuItem = (item: MenuItem, index: number) => {
    const handleClick = () => {
      if (onClick) onClick();
      // Close mobile menu when item is clicked
      if (isMobile) setMobileMenuOpen(false);
    };

    const isHovered = hoveredIndex === index;

    // Determine the link URL
    let linkUrl = '#';
    let isExternal = false;
    
    if (item.link_type === 'external' && item.external_url) {
      linkUrl = item.external_url;
      isExternal = true;
    } else if (item.page && pages.length > 0) {
      const page = pages.find(p => p.id === item.page);
      if (page) {
        // Convert page name to URL format: remove special chars, convert to lowercase, replace spaces with underscores
        let urlPath = page.name
          .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
          .trim() // Remove leading/trailing spaces
          .replace(/\s+/g, '_') // Replace spaces with underscores
          .toLowerCase(); // Convert to lowercase
        
        // Handle special cases for home page
        if (urlPath === 'home' || urlPath === 'index') {
          linkUrl = '/';
        } else {
          linkUrl = `/${urlPath}`;
        }
      }
    } else if (item.page) {
      // Fallback: if no pages array provided, try to use the page ID directly
      // This handles the case where page is a simple string rather than UUID
      if (item.page.length < 36) { // Not a UUID, probably a simple name
        let urlPath = item.page
          .replace(/[^a-zA-Z0-9\s]/g, '') 
          .trim()
          .replace(/\s+/g, '_')
          .toLowerCase();
        linkUrl = urlPath === 'home' || urlPath === 'index' ? '/' : `/${urlPath}`;
      } else {
        // It's a UUID but we don't have page data - create a fallback based on menu item name
        let urlPath = item.name
          .replace(/[^a-zA-Z0-9\s]/g, '') 
          .trim()
          .replace(/\s+/g, '_')
          .toLowerCase();
        linkUrl = urlPath === 'home' || urlPath === 'index' ? '/' : `/${urlPath}`;
      }
    }

    // Style for mobile menu items
    const mobileItemClass = isMobile && direction === 'horizontal' 
      ? 'block w-full text-left px-4 py-3 hover:bg-gray-100' 
      : '';

    return (
      <div
        key={item.id}
        className={`relative ${direction === 'horizontal' && !isMobile ? 'inline-block' : 'block'}`}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {linkUrl !== '#' ? (
          <Link
            href={linkUrl}
            onClick={handleClick}
            className={`px-4 py-2 ${menu.fontSize || 'text-sm'} ${mobileItemClass} ${
              isHovered ? 'text-base transition-all duration-200' : ''
            }`}
            style={{ fontFamily: menu.font }}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer nofollow' : undefined}
          >
            {item.name}
          </Link>
        ) : (
          <span 
            className={`px-4 py-2 ${menu.fontSize || 'text-sm'} ${mobileItemClass} ${
              isHovered ? 'text-base transition-all duration-200' : ''
            } cursor-pointer`}
            style={{ fontFamily: menu.font }}
            onClick={handleClick}
          >
            {item.name}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Hamburger menu for mobile horizontal menus */}
      {isMobile && direction === 'horizontal' && (
        <div className="relative">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 focus:outline-none hover:bg-gray-100 rounded-md transition-colors duration-200"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
          
                     {mobileMenuOpen && (
             <div className="absolute top-full right-0 bg-white shadow-lg rounded-lg mt-2 z-[9999] w-64 border border-gray-200">
               <nav className="flex flex-col py-2">
                 {menu.items?.map((item, index) => renderMenuItem(item, index)) || []}
               </nav>
             </div>
           )}
        </div>
      )}
      
      {/* Regular menu for desktop or vertical menus */}
      {(!isMobile || direction === 'vertical') && (
        <nav className={`${direction === 'horizontal' ? 'flex space-x-4' : 'flex flex-col'} ${menu.align === 'Left' ? 'justify-start' : menu.align === 'Center' ? 'justify-center' : menu.align === 'Right' ? 'justify-end' : ''}`}>
          {menu.items?.filter(item => !item.hiddenOnDesktop).map((item, index) => renderMenuItem(item, index)) || []}
        </nav>
      )}
    </>
  );
}
