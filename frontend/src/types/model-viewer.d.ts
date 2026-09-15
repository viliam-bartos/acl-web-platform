import * as React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          poster?: string;
          'camera-controls'?: boolean | string;
          'touch-action'?: string;
          'auto-rotate'?: boolean | string;
          'auto-rotate-delay'?: string | number;
          'rotation-per-second'?: string;
          'shadow-intensity'?: string | number;
          'shadow-softness'?: string | number;
          exposure?: string | number;
          'camera-orbit'?: string;
          'min-camera-orbit'?: string;
          'max-camera-orbit'?: string;
          'interaction-prompt'?: string;
          loading?: string;
          style?: React.CSSProperties;
        },
        HTMLElement
      >;
    }
  }

  interface ModelViewerElement extends HTMLElement {
    cameraOrbit: string;
    fieldOfView: string;
    model?: {
      materials?: Array<{
        name?: string;
        setAlphaMode?: (mode: string) => void;
        setAlphaCutoff?: (cutoff: number) => void;
        pbrMetallicRoughness?: {
          baseColorFactor: number[];
          setBaseColorFactor: (color: number[]) => void;
        };
      }>;
    };
  }
}

export {};
