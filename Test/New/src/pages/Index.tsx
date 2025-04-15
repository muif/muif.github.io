import SubscriptionForm from "@/components/SubscriptionForm";
import Header from "@/components/Header";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header />
      <div className="container mx-auto py-8 px-4">
        <div className="w-full max-w-xl mx-auto">
          <SubscriptionForm />
        </div>
      </div>
    </div>
  );
};

export default Index;
