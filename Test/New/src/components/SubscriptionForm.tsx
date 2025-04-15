
import { useState, useEffect } from "react";
import { format, addDays, addMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { FaUser, FaPhone, FaCalendarAlt, FaMoneyBillWave, FaHistory, FaWhatsapp } from "react-icons/fa";

interface FormData {
  name: string;
  phone: string;
  activationDate: string;
  expiryDate: string;
  price: number;
  previousDebt: number;
}

const SubscriptionForm = () => {
  const now = new Date();
  const formattedDateTime = format(now, "yyyy-MM-dd'T'HH:mm");
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    activationDate: formattedDateTime,
    expiryDate: "",
    price: 35,
    previousDebt: 0,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [calculationType, setCalculationType] = useState<'30days' | 'month'>('30days');

  useEffect(() => {
    if (formData.activationDate) {
      const activationDateTime = new Date(formData.activationDate);
      let expiryDateTime;
      
      if (calculationType === '30days') {
        expiryDateTime = addDays(activationDateTime, 30);
      } else {
        expiryDateTime = addMonths(activationDateTime, 1);
      }
      
      setFormData({
        ...formData,
        expiryDate: format(expiryDateTime, "yyyy-MM-dd'T'HH:mm"),
      });
    }
  }, [formData.activationDate, calculationType]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'price' || name === 'previousDebt') {
      setFormData({
        ...formData,
        [name]: Number(value),
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };
  
  const handleSelectChange = (value: string) => {
    setFormData({
      ...formData,
      price: Number(value),
    });
  };
  
  const handleCurrentDateTime = () => {
    const now = new Date();
    setFormData({
      ...formData,
      activationDate: format(now, "yyyy-MM-dd'T'HH:mm"),
    });
  };
  
  const handleCalculationTypeChange = (value: '30days' | 'month') => {
    setCalculationType(value);
  };
  
  const formatArabicTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'مساءً' : 'صباحًا';
    const hour12 = hours % 12 || 12; // Convert to 12-hour format
    
    // Format month/day/year hour:minute period
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    if (!formData.phone || formData.phone.trim() === '') {
      alert('الرجاء إدخال رقم الهاتف');
      setIsSubmitting(false);
      return;
    }
    
    if (!formData.name || formData.name.trim() === '') {
      alert('الرجاء إدخال اسم المشترك');
      setIsSubmitting(false);
      return;
    }
    
    const activationDateTime = new Date(formData.activationDate);
    const expiryDateTime = new Date(formData.expiryDate);
    
    const formattedActivationDate = formatArabicTime(activationDateTime);
    const formattedExpiryDate = formatArabicTime(expiryDateTime);
    
    const price = Number(formData.price);
    const previousDebt = Number(formData.previousDebt);
    
    const totalAmount = price + previousDebt;
    
    let message = `تحية طيبة ${formData.name}\n`;
    message += `تم تفعيل اشتراك الانترنت لديك بتاريخ ${formattedActivationDate}\n`;
    message += `ينتهي اشتراكك بتاريخ ${formattedExpiryDate}\n`;
    message += `سعر الاشتراك ${price} الف دينار\n\n`;
    
    if (previousDebt > 0) {
      message += `الديون السابقة ${previousDebt} الف دينار\n`;
      message += `صافي الديون ${totalAmount} الف دينار\n\n`;
    }
    
    message += "شكرا لاختيارك خدماتنا";
    
    let phoneNumber = formData.phone.trim();
    if (phoneNumber.startsWith("+")) {
      phoneNumber = phoneNumber.substring(1);
    } else if (phoneNumber.startsWith("0")) {
      phoneNumber = "964" + phoneNumber.substring(1);
    } else if (!phoneNumber.startsWith("964")) {
      phoneNumber = "964" + phoneNumber;
    }
    
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
    
    setIsSubmitting(false);
  };
  
  return (
    <Card className="w-full max-w-xl mx-auto shadow-lg rounded-lg overflow-hidden border-primary/20" dir="rtl">
      <CardHeader className="bg-primary text-primary-foreground text-center py-6">
        <CardTitle className="text-2xl font-bold">نظام تسجيل اشتراكات الإنترنت</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <FaUser className="text-primary" />
              اسم المشترك
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder="أدخل اسم المشترك"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <FaPhone className="text-primary" />
              رقم الهاتف
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
              required
              placeholder="أدخل رقم الهاتف"
              dir="ltr"
              className="text-right"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="activationDate" className="flex items-center gap-2">
              <FaCalendarAlt className="text-primary" />
              تاريخ التفعيل
            </Label>
            <div className="flex gap-2">
              <Input
                id="activationDate"
                name="activationDate"
                type="datetime-local"
                value={formData.activationDate}
                onChange={handleInputChange}
                required
                className="flex-1 pointer-events-auto"
              />
              <Button 
                type="button" 
                size="sm"
                onClick={handleCurrentDateTime}
                variant="outline"
                className="whitespace-nowrap"
              >
                الوقت الحالي
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FaCalendarAlt className="text-primary" />
              طريقة حساب تار��خ الانتهاء
            </Label>
            <RadioGroup 
              value={calculationType} 
              onValueChange={(value) => handleCalculationTypeChange(value as '30days' | 'month')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="30days" id="30days" />
                <Label htmlFor="30days">نظام 30 يوم</Label>
              </div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <RadioGroupItem value="month" id="month" />
                <Label htmlFor="month">نظام شهر</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="expiryDate" className="flex items-center gap-2">
              <FaCalendarAlt className="text-primary" />
              تاريخ الانتهاء (محسوب تلقائياً)
            </Label>
            <Input
              id="expiryDate"
              name="expiryDate"
              type="datetime-local"
              value={formData.expiryDate}
              readOnly
              disabled
              className="opacity-70 bg-gray-50"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="price" className="flex items-center gap-2">
              <FaMoneyBillWave className="text-primary" />
              السعر (ألف دينار)
            </Label>
            <Select 
              value={formData.price.toString()} 
              onValueChange={handleSelectChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر السعر" />
              </SelectTrigger>
              <SelectContent>
                {[30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 100].map((price) => (
                  <SelectItem key={price} value={price.toString()}>
                    {price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="previousDebt" className="flex items-center gap-2">
              <FaHistory className="text-primary" />
              الديون السابقة (اختياري)
            </Label>
            <Input
              id="previousDebt"
              name="previousDebt"
              type="number"
              value={formData.previousDebt || ""}
              onChange={handleInputChange}
              placeholder="أدخل قيمة الديون السابقة (إن وجدت)"
              min="0"
            />
          </div>
          
          <div className="pt-4">
            <Button 
              type="submit" 
              className="w-full text-lg py-6 gap-2 items-center" 
              disabled={isSubmitting}
            >
              <FaWhatsapp size={20} />
              {isSubmitting ? 'جاري المعالجة...' : 'حفظ وإرسال'}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="text-center text-sm text-muted-foreground flex justify-center flex-col gap-1">
        <div>نظام إدارة اشتراكات الإنترنت © {new Date().getFullYear()}</div>
        <div className="text-xs text-slate-400">تم تطويره بواسطة Lovable</div>
      </CardFooter>
    </Card>
  );
};

export default SubscriptionForm;
