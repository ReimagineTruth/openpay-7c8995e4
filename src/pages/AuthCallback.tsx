import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader } from "lucide-react";
import { phantomConnect } from "@/lib/phantomConnect";
import { toast } from "sonner";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get Phantom Connect parameters from URL
        const phantomSession = searchParams.get('phantom_session');
        const errorCode = searchParams.get('error_code');
        const errorMessage = searchParams.get('error_message');

        if (errorCode) {
          setStatus('error');
          setMessage(errorMessage || 'Authentication failed');
          toast.error('Phantom Connect authentication failed');
          return;
        }

        if (phantomSession) {
          // Initialize Phantom Connect with session
          const initialized = await phantomConnect.initialize();
          if (initialized) {
            // Try to connect using the session
            const connected = await phantomConnect.connect();
            if (connected) {
              setStatus('success');
              setMessage('Successfully connected to Phantom wallet!');
              toast.success('Phantom wallet connected successfully!');
              
              // Redirect to dashboard after 2 seconds
              setTimeout(() => {
                navigate('/dashboard');
              }, 2000);
            } else {
              setStatus('error');
              setMessage('Failed to establish wallet connection');
              toast.error('Failed to connect to wallet');
            }
          } else {
            setStatus('error');
            setMessage('Failed to initialize Phantom Connect');
            toast.error('Failed to initialize Phantom Connect');
          }
        } else {
          setStatus('error');
          setMessage('No authentication session found');
          toast.error('No authentication session found');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
          setMessage('An unexpected error occurred');
        toast.error('Authentication callback failed');
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate]);

  const handleRetry = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue to-[#072a7a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              {status === 'loading' && <Loader className="h-6 w-6 animate-spin" />}
              {status === 'success' && <CheckCircle className="h-6 w-6 text-green-500" />}
              {status === 'error' && <AlertCircle className="h-6 w-6 text-red-500" />}
              Phantom Connect
            </CardTitle>
            <CardDescription>
              {status === 'loading' && 'Processing authentication...'}
              {status === 'success' && 'Authentication successful!'}
              {status === 'error' && message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === 'loading' && (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Please wait while we process your Phantom Connect authentication...
                </p>
                <div className="flex justify-center">
                  <Loader className="h-8 w-8 animate-spin text-paypal-blue" />
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center space-y-4">
                <p className="text-sm text-green-600">
                  Your Phantom wallet has been successfully connected to OpenPay!
                </p>
                <p className="text-xs text-muted-foreground">
                  You will be redirected to the dashboard automatically...
                </p>
                <Button 
                  onClick={handleRetry}
                  className="w-full"
                >
                  Go to Dashboard
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center space-y-4">
                <p className="text-sm text-red-600">
                  {message || 'Failed to connect to Phantom wallet'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Please try again or contact support if the issue persists.
                </p>
                <div className="space-y-2">
                  <Button 
                    onClick={handleRetry}
                    variant="outline"
                    className="w-full"
                  >
                    Try Again
                  </Button>
                  <Button 
                    onClick={() => window.open('https://phantom.app/', '_blank')}
                    variant="secondary"
                    className="w-full"
                  >
                    Download Phantom Wallet
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthCallback;
