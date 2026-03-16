import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft, Globe, Send, History, TrendingUp, Users, Shield, Clock, CheckCircle, AlertCircle, Search, Filter, ChevronDown, Calculator, Banknote, Receipt, Star, Info, Phone, Mail, MapPin, Store, DollarSign, BarChart3, X } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import { format } from "date-fns";
import MerchantStoreManager from "@/components/remittance/MerchantStoreManager";
import TransactionProcessor from "@/components/remittance/TransactionProcessor";
import RevenueTracker from "@/components/remittance/RevenueTracker";

const OPENPAY_ICON_URL = "/openpay-logo.jpg";

interface MerchantStore {
  id: string;
  store_name: string;
  business_type: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email?: string;
  is_active: boolean;
  is_verified: boolean;
  verification_status: string;
}

const RemittanceCenterPage = () => {
  const navigate = useNavigate();
  const { currencies, format: formatCurrency } = useCurrency();
  
  const [activeTab, setActiveTab] = useState("stores");
  const [selectedStore, setSelectedStore] = useState<MerchantStore | null>(null);

  const handleStoreSelect = (store: MerchantStore) => {
    setSelectedStore(store);
    setActiveTab("transactions");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-paypal-blue to-[#0073e6] text-white">
        <div className="flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Remittance Center</h1>
            <p className="text-sm opacity-90">
              {selectedStore ? selectedStore.store_name : "Manage your remittance business"}
            </p>
          </div>
          {selectedStore && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => {
                setSelectedStore(null);
                setActiveTab("stores");
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="stores" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Stores
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2" disabled={!selectedStore}>
              <Send className="h-4 w-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="revenue" className="flex items-center gap-2" disabled={!selectedStore}>
              <BarChart3 className="h-4 w-4" />
              Revenue
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2" disabled={!selectedStore}>
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Stores Tab */}
          <TabsContent value="stores">
            <MerchantStoreManager onStoreSelect={handleStoreSelect} />
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <TransactionProcessor selectedStore={selectedStore} />
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue">
            <RevenueTracker selectedStore={selectedStore} />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              <div className="text-center py-12">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Advanced Analytics</h3>
                <p className="text-muted-foreground">Coming soon - Detailed business insights and performance metrics</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav active="menu" />
    </div>
  );
};

export default RemittanceCenterPage;
