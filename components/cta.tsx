'use client';
import React, { useState, useRef, useEffect } from 'react';

interface CTAButton {
  buttonTitle: string;
  page: string;
}

interface StyleSettings {
  fontFamily?: string;
  color?: string;
  fontSize?: string;
}

interface CTAData {
  headline: string;
  subheader?: string;
  subsubheader?: string;
  buttons?: CTAButton[];
  headlineStyle?: StyleSettings;
  subheaderStyle?: StyleSettings;
  subsubheaderStyle?: StyleSettings;
  buttonStyle?: StyleSettings;
}

interface RCTAProps {
  custom_view_description: string;
  onNavigate: (pageId: string) => void;
  isPaigeLoading?: boolean;
}

const RCTA: React.FC<RCTAProps> = ({ custom_view_description, onNavigate, isPaigeLoading = false }) => {
  let ctaData: CTAData;
  
  try {
    ctaData = JSON.parse(custom_view_description || '{}');
  } catch {
    ctaData = { headline: 'Call to Action' };
  }
  
  // Helper function to create style object
  const getStyle = (styleSettings?: StyleSettings, defaultStyles?: React.CSSProperties): React.CSSProperties => {
    const style: React.CSSProperties = { ...defaultStyles };
    
    if (styleSettings) {
      if (styleSettings.fontFamily) {
        style.fontFamily = styleSettings.fontFamily;
      }
      if (styleSettings.color) {
        style.color = styleSettings.color;
      }
      if (styleSettings.fontSize) {
        style.fontSize = styleSettings.fontSize;
      }
    }
    
    return style;
  };

  const handleButtonClick = (pageId: string) => {
    if (isPaigeLoading) {
      console.log('Navigation blocked: Paige is currently processing a request');
      return;
    }
    if (pageId) {
      onNavigate(pageId);
    }
  };

  return (
    <div className="text-center py-8 px-4">
      {/* Headline */}
      {ctaData.headline && (
        <h1 
          className="text-4xl font-bold mb-4"
          style={getStyle(ctaData.headlineStyle, { 
            fontSize: '2.5rem', 
            fontWeight: 'bold',
            marginBottom: '1rem',
            color: '#111827' 
          })}
        >
          {ctaData.headline}
        </h1>
      )}
      
      {/* Subheader */}
      {ctaData.subheader && (
        <h3 
          className="text-xl font-semibold mb-3"
          style={getStyle(ctaData.subheaderStyle, {
            fontSize: '1.25rem',
            fontWeight: '600',
            marginBottom: '0.75rem',
            color: '#374151'
          })}
        >
          {ctaData.subheader}
        </h3>
      )}
      
      {/* Sub-subheader */}
      {ctaData.subsubheader && (
        <p 
          className="text-lg mb-6"
          style={getStyle(ctaData.subsubheaderStyle, {
            fontSize: '1.125rem',
            marginBottom: '1.5rem',
            color: '#4B5563'
          })}
        >
          {ctaData.subsubheader}
        </p>
      )}
      
      {/* Buttons */}
      {ctaData.buttons && ctaData.buttons.length > 0 && (
        <div className="flex justify-center gap-4 flex-wrap">
          {ctaData.buttons.map((button, index) => {
            const buttonStyles = getStyle(ctaData.buttonStyle, {
              color: '#FFFFFF',
              fontSize: '1rem',
              fontWeight: '500'
            });
            
            return (
              <button
                key={index}
                onClick={() => handleButtonClick(button.page)}
                className={`px-6 py-3 bg-[#516ab8] rounded-lg hover:bg-blue-700 transition-colors ${
                  isPaigeLoading ? 'opacity-50 cursor-not-allowed' : ''
                } ${!button.page ? 'opacity-75 cursor-not-allowed' : ''}`}
                style={buttonStyles}
                disabled={isPaigeLoading || !button.page}
              >
                {button.buttonTitle || 'Button'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RCTA;
