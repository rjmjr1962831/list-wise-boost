import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SafeHead } from "@/components/SafeHead";

const DEVICES = [
  {
    name: 'iPhone SE',
    width: 375,
    height: 667,
    scale: 2,
  },
  {
    name: 'iPhone 13',
    width: 390,
    height: 844,
    scale: 3,
  },
  {
    name: 'iPhone 13 Pro Max',
    width: 428,
    height: 926,
    scale: 3,
  },
  {
    name: 'Samsung Galaxy S21',
    width: 360,
    height: 800,
    scale: 3,
  },
  {
    name: 'Google Pixel 5',
    width: 393,
    height: 851,
    scale: 2.75,
  },
];

const MobilePreview = () => {
  const [url, setUrl] = useState('https://staging.top10lists.us');
  const [previewUrl, setPreviewUrl] = useState('https://staging.top10lists.us');

  const handlePreview = () => {
    setPreviewUrl(url);
  };

  return (
    <>
      <SafeHead>
        <title>Mobile Preview Tool</title>
      </SafeHead>
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-card rounded-lg shadow-lg p-6 mb-6">
            <h1 className="text-3xl font-bold mb-4">📱 Mobile Preview Tool</h1>
            <div className="flex gap-2">
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter URL to preview"
                className="flex-1"
              />
              <Button onClick={handlePreview}>
                Preview
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEVICES.map((device) => (
              <div
                key={device.name}
                className="bg-card rounded-lg shadow-lg overflow-hidden"
              >
                <div className="bg-muted px-4 py-3 border-b">
                  <h3 className="font-semibold text-sm">{device.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {device.width}×{device.height} @ {device.scale}x
                  </p>
                </div>
                <div className="p-4 bg-gray-100 flex justify-center">
                  <div
                    className="bg-white shadow-xl rounded-lg overflow-hidden"
                    style={{
                      width: device.width / 2,
                      height: device.height / 2,
                      transform: 'scale(0.9)',
                      transformOrigin: 'top center',
                    }}
                  >
                    <iframe
                      src={previewUrl}
                      title={device.name}
                      className="w-full h-full border-0"
                      style={{
                        width: device.width,
                        height: device.height,
                        transform: 'scale(0.5)',
                        transformOrigin: '0 0',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 bg-card rounded-lg shadow-lg p-4">
            <h2 className="text-lg font-semibold mb-2">Quick Links</h2>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUrl('https://staging.top10lists.us');
                  setPreviewUrl('https://staging.top10lists.us');
                }}
              >
                Staging Homepage
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUrl('https://top10lists.us');
                  setPreviewUrl('https://top10lists.us');
                }}
              >
                Production Homepage
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.close()}
              >
                Close Window
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobilePreview;
