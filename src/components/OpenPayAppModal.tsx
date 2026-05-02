import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, Sparkles, Smartphone, ExternalLink, CheckCircle, Star, Users, Shield, Zap } from "lucide-react";
import { toast } from "sonner";

interface OpenPayAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OpenPayAppModal = ({ isOpen, onClose }: OpenPayAppModalProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleDownloadApk = async () => {
    try {
      setIsDownloading(true);
      setDownloadProgress(0);

      // Simulate download progress
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 300);

      // Download APK
      const apkUrl = "/openpay-latest.apk";
      const link = document.createElement("a");
      link.href = apkUrl;
      link.download = "openpay-latest.apk";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Complete download
      setTimeout(() => {
        clearInterval(progressInterval);
        setDownloadProgress(100);
        setIsDownloading(false);
        toast.success("Download completed! Check your downloads folder.");
      }, 2000);

    } catch (error) {
      setIsDownloading(false);
      setDownloadProgress(0);
      toast.error("Download failed. Please try again.");
    }
  };

  const handleExploreApps = () => {
    window.open("/openapp", "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden bg-white shadow-2xl border border-gray-200">
        <DialogTitle className="sr-only">OpenPay App</DialogTitle>
        <DialogDescription className="sr-only">Download and explore OpenPay mobile applications</DialogDescription>
        
        {/* Header */}
        <div className="bg-gradient-to-br from-paypal-blue via-blue-600 to-[#0073e6] p-6 text-center text-white relative overflow-hidden">
          {/* Animated background particles */}
          <div className="absolute inset-0">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute h-2 w-2 rounded-full bg-white/10 animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${8 + Math.random() * 4}s`
                }}
              />
            ))}
          </div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>

          {/* App icon */}
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-white/20 blur-xl animate-pulse" />
            <div className="relative h-16 w-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 mx-auto">
              <Smartphone className="h-8 w-8 text-white animate-float" />
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2">OpenPay Mobile</h2>
          <p className="text-white/90 text-sm">Your financial hub in your pocket</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Features */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-gray-700">Fast Transfers</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-gray-700">Secure</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
              <Users className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-gray-700">Pi Network</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
              <Star className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-medium text-gray-700">4.8 Rating</span>
            </div>
          </div>

          {/* App Info */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Why OpenPay Mobile?</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Send and receive OpenUSD instantly</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>QR code payments for easy transactions</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Real-time balance tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Advanced security features</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={handleDownloadApk}
              disabled={isDownloading}
              className="w-full bg-paypal-blue hover:bg-paypal-blue/90 text-white font-semibold py-3 rounded-xl transition-all duration-300"
            >
              {isDownloading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Downloading... {Math.round(downloadProgress)}%
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download APK
                </>
              )}
            </Button>

            <Button
              onClick={handleExploreApps}
              variant="outline"
              className="w-full border-paypal-blue text-paypal-blue hover:bg-paypal-blue/10 font-semibold py-3 rounded-xl transition-all duration-300"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Explore More Apps
            </Button>
          </div>

          {/* Progress Bar */}
          {isDownloading && (
            <div className="mt-4">
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-paypal-blue rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Installation Note */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>Note:</strong> Enable "Unknown Sources" in your device settings to install the APK.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OpenPayAppModal;
