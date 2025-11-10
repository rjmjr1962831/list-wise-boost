import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Clock, CheckCircle2 } from "lucide-react";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { z } from "zod";

const bookingSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  phone: z.string().trim().min(10, "Phone number must be at least 10 digits").max(20, "Phone must be less than 20 characters"),
  reason: z.string().trim().min(10, "Please provide at least 10 characters").max(500, "Reason must be less than 500 characters"),
});

interface AppointmentType {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  color: string;
}

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

const BookAppointment = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedAppointmentType, setSelectedAppointmentType] = useState<string>("");
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  const { trackEvent } = useGA4Tracking();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    reason: "",
  });

  // Fetch appointment types
  useEffect(() => {
    const fetchAppointmentTypes = async () => {
      const { data, error } = await supabase
        .from("appointment_types")
        .select("*")
        .eq("active", true)
        .order("name");
      
      if (error) {
        console.error("Error fetching appointment types:", error);
        return;
      }
      setAppointmentTypes(data || []);
    };

    fetchAppointmentTypes();
  }, []);

  // Fetch availability slots
  useEffect(() => {
    const fetchAvailability = async () => {
      const { data, error } = await supabase
        .from("availability_slots")
        .select("*")
        .eq("active", true)
        .order("day_of_week");
      
      if (error) {
        console.error("Error fetching availability:", error);
        return;
      }
      setAvailabilitySlots(data || []);
    };

    fetchAvailability();
  }, []);

  // Generate time slots when date is selected
  useEffect(() => {
    if (!selectedDate) {
      setTimeSlots([]);
      return;
    }

    const dayOfWeek = selectedDate.getDay();
    const daySlots = availabilitySlots.filter(slot => slot.day_of_week === dayOfWeek);

    if (daySlots.length === 0) {
      setTimeSlots([]);
      return;
    }

    // Generate 30-minute intervals
    const slots: TimeSlot[] = [];
    daySlots.forEach(slot => {
      const [startHour, startMin] = slot.start_time.split(':').map(Number);
      const [endHour, endMin] = slot.end_time.split(':').map(Number);
      
      let currentHour = startHour;
      let currentMin = startMin;
      
      while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
        const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
        slots.push({ time: timeStr, available: true });
        
        currentMin += 30;
        if (currentMin >= 60) {
          currentMin = 0;
          currentHour++;
        }
      }
    });

    setTimeSlots(slots);
  }, [selectedDate, availabilitySlots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate || !selectedTime || !selectedAppointmentType) {
      toast.error("Please select date, time, and appointment type");
      return;
    }

    // Validate form data
    try {
      bookingSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Calculate end time based on appointment type duration
      const appointmentType = appointmentTypes.find(t => t.id === selectedAppointmentType);
      const [startHour, startMin] = selectedTime.split(':').map(Number);
      const duration = appointmentType?.duration_minutes || 30;
      const endHour = Math.floor((startHour * 60 + startMin + duration) / 60);
      const endMin = (startHour * 60 + startMin + duration) % 60;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

      const { error } = await supabase.from("appointments").insert([
        {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          reason: formData.reason,
          appointment_type_id: selectedAppointmentType,
          appointment_date: selectedDate.toISOString().split('T')[0],
          start_time: selectedTime,
          end_time: endTime,
          status: 'scheduled',
        },
      ]);

      if (error) throw error;

      // Track successful booking
      trackEvent('appointment_booked', {
        agent_name: appointmentType?.name,
        market: 'booking_page',
        page_path: '/book-appointment',
      });

      toast.success("Appointment booked! You'll receive a confirmation email soon.");
      setBookingComplete(true);
      
      // Reset form
      setFormData({ name: "", email: "", phone: "", reason: "" });
      setSelectedDate(undefined);
      setSelectedTime("");
      setSelectedAppointmentType("");
    } catch (error) {
      console.error("Error booking appointment:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedAppointmentTypeName = appointmentTypes.find(t => t.id === selectedAppointmentType)?.name;

  return (
    <>
      <Helmet>
        <title>Book an Appointment | Schedule Your Consultation</title>
        <meta name="description" content="Book an appointment with our team. Choose from consultation, demo, or follow-up sessions. Easy online scheduling with instant confirmation." />
        <meta name="keywords" content="book appointment, schedule consultation, online booking, appointment scheduling" />
        <link rel="canonical" href={window.location.href} />
        
        {/* Schema.org markup for appointments */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            "name": "Appointment Booking",
            "description": "Professional appointment booking service",
            "url": window.location.href,
            "availableChannel": {
              "@type": "ServiceChannel",
              "serviceUrl": window.location.href,
              "serviceType": "Online Booking"
            }
          })}
        </script>
      </Helmet>

      {/* Google Tag Manager */}
      <script dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-P3MLNSCV');`
      }} />

      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Book Your Appointment
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Schedule a time that works best for you. Choose your preferred appointment type, date, and time.
            </p>
          </header>

          {bookingComplete ? (
            <Card className="max-w-2xl mx-auto">
              <CardContent className="pt-8 text-center">
                <CheckCircle2 className="w-20 h-20 mx-auto mb-4 text-accent" />
                <h2 className="text-2xl font-bold mb-2">Appointment Confirmed!</h2>
                <p className="text-muted-foreground mb-6">
                  We've received your booking request. You'll receive a confirmation email shortly with all the details.
                </p>
                <Button onClick={() => setBookingComplete(false)}>
                  Book Another Appointment
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-8">
              {/* Left Column - Date & Time Selection */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5" />
                      Select Appointment Type
                    </CardTitle>
                    <CardDescription>Choose the type of appointment you need</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {appointmentTypes.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => {
                            setSelectedAppointmentType(type.id);
                            trackEvent('appointment_type_selected', {
                              agent_name: type.name,
                              market: 'booking_page',
                            });
                          }}
                          className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                            selectedAppointmentType === type.id
                              ? 'border-accent bg-accent/10'
                              : 'border-border hover:border-accent/50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-foreground">{type.name}</h3>
                              <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                            </div>
                            <span className="text-xs bg-muted px-2 py-1 rounded">
                              {type.duration_minutes} min
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5" />
                      Choose a Date
                    </CardTitle>
                    <CardDescription>Select your preferred date</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        setSelectedTime("");
                        if (date) {
                          trackEvent('appointment_date_selected', {
                            market: 'booking_page',
                            page_path: '/book-appointment',
                          });
                        }
                      }}
                      disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                      className="rounded-md border"
                    />
                  </CardContent>
                </Card>

                {selectedDate && timeSlots.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        Select Time
                      </CardTitle>
                      <CardDescription>Available time slots for {selectedDate.toLocaleDateString()}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2">
                        {timeSlots.map((slot) => (
                          <Button
                            key={slot.time}
                            variant={selectedTime === slot.time ? "default" : "outline"}
                            onClick={() => {
                              setSelectedTime(slot.time);
                              trackEvent('appointment_time_selected', {
                                market: 'booking_page',
                              });
                            }}
                            disabled={!slot.available}
                            className="w-full"
                          >
                            {slot.time}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column - Contact Information Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Information</CardTitle>
                  <CardDescription>Fill in your contact details to complete the booking</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        Full Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                        maxLength={255}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        Phone <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                        maxLength={20}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reason">
                        Reason for Appointment <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="reason"
                        placeholder="Please describe what you'd like to discuss..."
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        required
                        className="min-h-[120px]"
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground">{formData.reason.length}/500 characters</p>
                    </div>

                    {selectedDate && selectedTime && selectedAppointmentType && (
                      <div className="p-4 bg-accent/10 border border-accent/30 rounded-lg">
                        <h3 className="font-semibold mb-2">Appointment Summary</h3>
                        <ul className="space-y-1 text-sm">
                          <li><strong>Type:</strong> {selectedAppointmentTypeName}</li>
                          <li><strong>Date:</strong> {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</li>
                          <li><strong>Time:</strong> {selectedTime}</li>
                        </ul>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting || !selectedDate || !selectedTime || !selectedAppointmentType}
                      size="lg"
                    >
                      {isSubmitting ? "Booking..." : "Confirm Appointment"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BookAppointment;
