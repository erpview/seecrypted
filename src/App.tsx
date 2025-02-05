import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Upload, Download, Lock, Image as ImageIcon, Sparkles, RefreshCw, Mail, Share2 } from 'lucide-react';
import { GhostLogo } from '@/components/ui/ghost-logo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface BaseImage extends HTMLImageElement {
  src: string;
}

const App = () => {
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [encodedImage, setEncodedImage] = useState<string>('');
  const [decodedMessage, setDecodedMessage] = useState<string>('');
  const [error, setError] = useState('');
  const [baseImage, setBaseImage] = useState<BaseImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageSource, setImageSource] = useState('upload');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedGeneratedImage, setSelectedGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [decodingImage, setDecodingImage] = useState<string | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [showDecodedMessage, setShowDecodedMessage] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Function to generate a secure key from password
  const generateKey = async (password: string, salt: Uint8Array = new Uint8Array(16)) => {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    
    // Use PBKDF2 to derive a key
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  };

  // Function to encrypt message
  const encryptMessage = async (message: string, password: string) => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      
      // Generate random salt and IV
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Generate key from password
      const key = await generateKey(password, salt);
      
      // Encrypt the message
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      
      // Combine salt, IV, and encrypted data
      const encryptedArray = new Uint8Array(encrypted);
      const result = new Uint8Array(salt.length + iv.length + encryptedArray.length);
      result.set(salt, 0);
      result.set(iv, salt.length);
      result.set(new Uint8Array(encrypted), salt.length + iv.length);
      
      return result;
    } catch (error) {
      throw new Error('Encryption failed: ' + (error as Error).message);
    }
  };

  // Function to decrypt message
  const decryptMessage = async (encryptedData: Uint8Array, password: string) => {
    try {
      // Extract salt and IV
      const salt = encryptedData.slice(0, 16);
      const iv = encryptedData.slice(16, 28);
      const data = encryptedData.slice(28);
      
      // Generate key from password
      const key = await generateKey(password, salt);
      
      // Decrypt the message
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      throw new Error('Decryption failed: ' + (error as Error).message);
    }
  };

  // Function to check if image is large enough for message
  const validateImageSize = (width: number, height: number, dataLength: number) => {
    const totalPixels = width * height;
    const requiredPixels = 32 + (dataLength * 8);
    
    if (totalPixels < requiredPixels) {
      const minSize = Math.ceil(Math.sqrt(requiredPixels));
      return {
        isValid: false,
        message: `Image too small! Your encrypted message needs ${requiredPixels} pixels.\nMinimum recommended size: ${minSize}×${minSize} pixels.\nCurrent image: ${width}×${height} pixels (${totalPixels} pixels available)`
      };
    }
    return { isValid: true };
  };

  // Function to scramble bits (additional security layer)
  const scrambleBits = (data: Uint8Array, key: Uint8Array) => {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      // XOR with key-derived value
      result[i] = data[i] ^ key[i % key.length];
    }
    return result;
  };

  // Function to load base image
  const loadBaseImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const img = new Image() as BaseImage;
      img.onload = () => {
        setBaseImage(img);
        setError('');
      };
      img.onerror = () => {
        setError('Error loading image');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Function to generate random images from Picsum
  const generateRandomImages = async () => {
    setIsGeneratingImage(true);
    setError('');
    
    try {
      const randomIds = Array.from({ length: 4 }, () => Math.floor(Math.random() * 1000));
      const images = randomIds.map(id => `https://picsum.photos/seed/${id}/800/600`);

      const loadedImages = await Promise.all(
        images.map(async (url) => {
          try {
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.crossOrigin = "anonymous";
              img.src = url;
            });
            return url;
          } catch (err) {
            console.error('Error loading image:', err);
            throw new Error('Failed to load image');
          }
        })
      );

      setGeneratedImages(loadedImages);
    } catch (err) {
      console.error('Error generating images:', err);
      setError('Error generating images. Please try again. If the problem persists, try using the upload option instead.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Function to handle generated image selection
  const handleGeneratedImageSelect = async (url: string) => {
    setError('');
    try {
      const img = new Image() as BaseImage;
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      setBaseImage(img);
      setSelectedGeneratedImage(url);
    } catch (err) {
      console.error('Error loading selected image:', err);
      setError('Error loading selected image. Please try selecting a different image or use the upload option.');
    }
  };

  // Function to encode message into image
  const encodeMessage = async () => {
    if (!message || !password) {
      setError('Please enter both message and password');
      return;
    }

    if (!baseImage) {
      setError('Please select an image first');
      return;
    }

    setIsLoading(true);
    try {
      // Encrypt and scramble the message
      const encryptedData = await encryptMessage(message, password);
      const keyData = await crypto.subtle.exportKey('raw', await generateKey(password));
      const scrambledData = scrambleBits(encryptedData, new Uint8Array(keyData));
      
      // Convert to binary string
      const binaryMessage = Array.from(scrambledData)
        .map(byte => byte.toString(2).padStart(8, '0'))
        .join('');

      // Check image size
      const imageWidth = baseImage.width;
      const imageHeight = baseImage.height;
      const sizeValidation = validateImageSize(imageWidth, imageHeight, scrambledData.length);
      
      if (!sizeValidation.isValid) {
        throw new Error(sizeValidation.message);
      }

      // Create canvas and encode
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      canvas.width = baseImage.width;
      canvas.height = baseImage.height;
      ctx.drawImage(baseImage, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Encode message length
      const messageLength = binaryMessage.length;
      for (let i = 0; i < 32; i++) {
        data[i * 4] = (data[i * 4] & 254) | ((messageLength >> i) & 1);
      }
      
      // Encode message
      for (let i = 0; i < binaryMessage.length; i++) {
        const pixelIndex = (i + 32) * 4;
        data[pixelIndex] = (data[pixelIndex] & 254) | parseInt(binaryMessage[i]);
      }
      
      ctx.putImageData(imageData, 0, 0);
      setEncodedImage(canvas.toDataURL());
      setError('');
    } catch (err) {
      setError('Error encoding message: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle image upload for decoding
  const handleDecodeImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        setDecodingImage(result);
        setDecodedMessage('');
        setError('');
      }
    };
    reader.readAsDataURL(file);
  };

  // Function to decode message from image
  const decodeMessage = async () => {
    if (!password) {
      setError('Please enter the password');
      return;
    }

    if (!decodingImage) {
      setError('Please upload an image first');
      return;
    }

    setIsDecoding(true);
    setError('');

    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = decodingImage;
      });

      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Extract message length
      let messageLength = 0;
      for (let i = 0; i < 32; i++) {
        messageLength |= (data[i * 4] & 1) << i;
      }
      
      // Extract message bits
      let binaryMessage = '';
      for (let i = 0; i < messageLength; i++) {
        const pixelIndex = (i + 32) * 4;
        binaryMessage += data[pixelIndex] & 1;
      }
      
      // Convert binary to bytes
      const bytes = new Uint8Array(binaryMessage.length / 8);
      for (let i = 0; i < binaryMessage.length; i += 8) {
        const byte = binaryMessage.substr(i, 8);
        bytes[i / 8] = parseInt(byte, 2);
      }

      // Unscramble and decrypt
      const keyData = await crypto.subtle.exportKey('raw', await generateKey(password));
      const unscrambledData = scrambleBits(bytes, new Uint8Array(keyData));
      const decryptedMessage = await decryptMessage(unscrambledData, password);
      
      setDecodedMessage(decryptedMessage);
      setShowDecodedMessage(true);
      setError('');
    } catch (err) {
      console.error('Error decoding message:', err);
      setError('Error decoding message: Invalid password or corrupted data');
    } finally {
      setIsDecoding(false);
    }
  };

  // Function to reset all state
  const resetApp = () => {
    setMessage('');
    setPassword('');
    setBaseImage(null);
    setEncodedImage('');
    setError('');
    setIsLoading(false);
    setImageSource('upload');
    setGeneratedImages([]);
    setSelectedGeneratedImage(null);
    setIsGeneratingImage(false);
    setDecodingImage(null);
    setIsDecoding(false);
    setDecodedMessage('');
    setShowDecodedMessage(false);
  };

  // Function to download the encoded image
  const downloadImage = () => {
    if (!encodedImage) return;
    
    const link = document.createElement('a');
    link.href = encodedImage;
    link.download = 'seecrypted-message.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to share via email
  const shareViaEmail = async () => {
    if (!encodedImage) return;
    
    try {
      // First download the image
      const response = await fetch(encodedImage);
      const blob = await response.blob();
      const file = new File([blob], 'seecrypted-message.png', { type: 'image/png' });
      
      // Create mailto link
      const mailtoLink = 'mailto:?subject=' + encodeURIComponent('SeeCrypted Message');
      window.location.href = mailtoLink;

      // Save the image file
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = 'seecrypted-message.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error sharing via email:', error);
      setError('Error preparing image for email. Please try downloading and attaching manually.');
    }
  };

  // Function to share via WhatsApp
  const shareViaWhatsApp = async () => {
    if (!encodedImage) return;
    
    try {
      // First download the image
      const response = await fetch(encodedImage);
      const blob = await response.blob();
      const file = new File([blob], 'seecrypted-message.png', { type: 'image/png' });
      
      // Save the image file
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = 'seecrypted-message.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Open WhatsApp
      window.open('https://web.whatsapp.com', '_blank');
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
      setError('Error preparing image for WhatsApp. Please try downloading and attaching manually.');
    }
  };

  // Update last activity time on user interaction
  useEffect(() => {
    const updateActivity = () => {
      setLastActivity(Date.now());
    };

    // Add event listeners for user activity
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    return () => {
      // Clean up event listeners
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
    };
  }, []);

  // Check for inactivity and auto-refresh
  useEffect(() => {
    const inactivityTimer = setInterval(() => {
      const inactiveTime = Date.now() - lastActivity;
      if (inactiveTime >= 15000) { // 15 seconds
        resetApp();
        setLastActivity(Date.now()); // Reset timer after refresh
      }
    }, 1000); // Check every second

    return () => clearInterval(inactivityTimer);
  }, [lastActivity]);

  return (
    <div className="min-h-screen bg-black/95 text-white flex items-center justify-center">
      <div className="w-[500px] px-4 py-8">
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3">
              <GhostLogo />
              <h1 className="text-4xl font-bold tracking-tight">SeeCrypted</h1>
            </div>
            <p className="text-muted-foreground">Hide secret messages in images securely</p>
            <Button
              variant="outline"
              size="icon"
              onClick={resetApp}
              className="mt-4"
              title="Reset App"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <Tabs defaultValue="encode" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="encode" className="space-x-2">
                <Upload className="w-4 h-4" />
                <span>Encode Message</span>
              </TabsTrigger>
              <TabsTrigger value="decode" className="space-x-2">
                <Download className="w-4 h-4" />
                <span>Decode Message</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-6 w-full">
              <TabsContent value="encode" className="space-y-6 w-full">
                <Card>
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Lock className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">Secret Message</CardTitle>
                    </div>
                    <CardDescription>
                      Enter your secret message and encryption password
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Set Password that you and message receiver knows</Label>
                      <Input
                        type="password"
                        placeholder="Enter encryption password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Textarea
                        placeholder="Enter your secret message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[100px] font-mono"
                      />
                    </div>
                    {message && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Message length: {message.length} characters</p>
                        <p>Required pixels: {32 + (message.length * 8)}</p>
                        <p>Minimum image size: {Math.ceil(Math.sqrt(32 + (message.length * 8)))}×{Math.ceil(Math.sqrt(32 + (message.length * 8)))} pixels</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <ImageIcon className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">Choose Base Image</CardTitle>
                    </div>
                    <CardDescription>
                      Upload your own image or generate one using AI
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <RadioGroup
                      value={imageSource}
                      onValueChange={setImageSource}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div>
                        <RadioGroupItem
                          value="upload"
                          id="upload"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="upload"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                        >
                          <Upload className="mb-3 h-6 w-6" />
                          <div className="space-y-1 text-center">
                            <p className="text-sm font-medium leading-none">Upload Image</p>
                            <p className="text-sm text-muted-foreground">
                              Use your own image
                            </p>
                          </div>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem
                          value="generate"
                          id="generate"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="generate"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                        >
                          <Sparkles className="mb-3 h-6 w-6" />
                          <div className="space-y-1 text-center">
                            <p className="text-sm font-medium leading-none">Generate Image</p>
                            <p className="text-sm text-muted-foreground">
                              Use AI generated images
                            </p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>

                    {imageSource === 'upload' ? (
                      <div className="space-y-4">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={loadBaseImage}
                          className="w-full"
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Button 
                          onClick={generateRandomImages}
                          className="w-full"
                          disabled={isGeneratingImage}
                        >
                          {isGeneratingImage ? 'Generating...' : 'Generate Random Images'}
                        </Button>
                        {generatedImages.length > 0 && (
                          <div className="grid grid-cols-2 gap-4">
                            {generatedImages.map((url, index) => (
                              <div
                                key={index}
                                className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                                  selectedGeneratedImage === url
                                    ? 'border-primary'
                                    : 'border-transparent hover:border-primary/50'
                                }`}
                                onClick={() => handleGeneratedImageSelect(url)}
                              >
                                <img
                                  src={url}
                                  alt={`Generated image ${index + 1}`}
                                  className="w-full h-auto"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {baseImage && (
                      <div className="rounded-lg overflow-hidden border">
                        <img
                          src={baseImage.src}
                          alt="Selected base image"
                          className="w-full h-auto"
                        />
                      </div>
                    )}

                    {encodedImage && (
                      <div className="space-y-4">
                        <p className="text-sm font-medium">Your encoded message is ready:</p>
                        <div className="rounded-lg overflow-hidden border">
                          <img
                            src={encodedImage}
                            alt="Encoded message"
                            className="w-full h-auto"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <Button 
                            onClick={downloadImage}
                            className="w-full"
                            variant="secondary"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                          <Button
                            onClick={shareViaEmail}
                            className="w-full"
                            variant="secondary"
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            Email
                          </Button>
                          <Button
                            onClick={shareViaWhatsApp}
                            className="w-full"
                            variant="secondary"
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            WhatsApp
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button 
                  onClick={encodeMessage} 
                  className="w-full"
                  disabled={isLoading || !password || !baseImage}
                >
                  {isLoading ? 'Encoding...' : 'Encode Message'}
                </Button>
              </TabsContent>

              <TabsContent value="decode" className="space-y-6 w-full">
                <Card className="w-full">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Lock className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">Decode Message</CardTitle>
                    </div>
                    <CardDescription>
                      Enter the password and upload the encoded image
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Insert Password you received from sender</Label>
                      <Input
                        type="password"
                        placeholder="Enter decryption password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Upload Encoded Image</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleDecodeImageUpload}
                        className="w-full"
                      />
                    </div>

                    {decodingImage && (
                      <div className="space-y-4">
                        <div className="rounded-lg overflow-hidden border">
                          <img
                            src={decodingImage}
                            alt="Image to decode"
                            className="w-full h-auto"
                          />
                        </div>
                        
                        <Button 
                          onClick={decodeMessage}
                          className="w-full"
                          disabled={isDecoding || !password}
                        >
                          {isDecoding ? 'Decoding...' : 'Decode Message'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>

          {error && (
            <Alert variant="destructive" className="w-full">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <Dialog open={showDecodedMessage} onOpenChange={setShowDecodedMessage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decoded Message</DialogTitle>
            <DialogDescription>
              Here's the secret message that was hidden in the image:
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <pre className="font-mono whitespace-pre-wrap break-words">{decodedMessage}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default App;