
import { useState, useEffect } from "react";

const Header = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // تحديث الوقت كل دقيقة
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <header className="py-4 px-6 bg-primary text-primary-foreground text-center w-full">
      <h1 className="text-2xl font-bold">نظام إدارة اشتراكات الإنترنت</h1>
    </header>
  );
};

export default Header;
