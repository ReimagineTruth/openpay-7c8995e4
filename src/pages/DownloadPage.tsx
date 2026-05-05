import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, ArrowLeft, Smartphone, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

const DownloadPage = () => {
  const navigate = useNavigate();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadComplete, setDownloadComplete] = useState(false);

  const handleDownloadApk = async () => {
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      setDownloadComplete(false);

      // Simulate download progress
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 500);

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
        setDownloadComplete(true);
        setIsDownloading(false);
        toast.success("Download completed! Check your downloads folder.");
      }, 3000);

    } catch (error) {
      setIsDownloading(false);
      setDownloadProgress(0);
      toast.error("Download failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-paypal-blue via-blue-600 to-[#072a7a] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <h1 className="text-xl font-bold">Download OpenPay</h1>
        <div className="w-20" />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-8">
        <div className="max-w-md mx-auto">
          {/* App Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/20 blur-xl animate-pulse" />
              <div className="relative h-24 w-24 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                <Smartphone className="h-12 w-12 text-white animate-float" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">OpenPay Mobile App</h2>
            <p className="text-white/80">Get the official OpenPay app for Android</p>
          </div>

          {/* Features */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-white/20">
            <h3 className="text-lg font-semibold text-white mb-4">Features:</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-white/90">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>Secure Pi Network transactions</span>
              </li>
              <li className="flex items-center gap-3 text-white/90">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>Send & receive OpenUSD</span>
              </li>
              <li className="flex items-center gap-3 text-white/90">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>QR code payments</span>
              </li>
              <li className="flex items-center gap-3 text-white/90">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>Real-time balance tracking</span>
              </li>
              <li className="flex items-center gap-3 text-white/90">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>Advanced security features</span>
              </li>
            </ul>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownloadApk}
            disabled={isDownloading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-paypal-blue font-semibold rounded-2xl transition-all duration-300 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isDownloading ? (
              <>
                <div className="h-5 w-5 border-2 border-paypal-blue/30 border-t-paypal-blue rounded-full animate-spin" />
                <span>Downloading... {Math.round(downloadProgress)}%</span>
              </>
            ) : downloadComplete ? (
              <>
                <CheckCircle className="h-5 w-5" />
                <span>Download Complete!</span>
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                <span>Download APK</span>
              </>
            )}
          </button>

          {/* Progress Bar */}
          {isDownloading && (
            <div className="mt-4">
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div className="text-white/80 text-sm">
                <p className="font-semibold mb-1">Installation Instructions:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Download the APK file</li>
                  <li>Enable "Unknown Sources" in your device settings</li>
                  <li>Tap the downloaded file to install</li>
                  <li>Follow the on-screen instructions</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav active="home" />
    </div>
  );
};

export default DownloadPage;
