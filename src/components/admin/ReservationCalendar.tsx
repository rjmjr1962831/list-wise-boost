import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Reservation {
  id: string;
  space_number: number;
  reservation_date: string;
  professional_id: string | null;
  status: string;
  notes: string | null;
  professional?: {
    name: string;
    email: string | null;
  } | null;
}

const SPACE_COUNT = 12;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-green-500',
  cancelled: 'bg-red-400',
};

export function ReservationCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  useEffect(() => {
    fetchReservations();
  }, [currentMonth]);

  const fetchReservations = async () => {
    setLoading(true);
    const startDate = format(monthStart, 'yyyy-MM-dd');
    const endDate = format(monthEnd, 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('parking_reservations')
      .select(`
        *,
        professional:professionals(name, email)
      `)
      .gte('reservation_date', startDate)
      .lte('reservation_date', endDate);

    if (error) {
      console.error('Error fetching reservations:', error);
      toast.error('Failed to load reservations');
    } else {
      setReservations(data || []);
    }
    setLoading(false);
  };

  const getReservation = (date: Date, spaceNumber: number): Reservation | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return reservations.find(
      r => r.reservation_date === dateStr && r.space_number === spaceNumber
    );
  };

  const handleCellClick = (date: Date, spaceNumber: number) => {
    const reservation = getReservation(date, spaceNumber);
    if (reservation) {
      setSelectedReservation(reservation);
      setDialogOpen(true);
    }
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Grid */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-background z-10 text-left p-2 border-b font-medium text-muted-foreground w-20">
                      Date
                    </th>
                    {Array.from({ length: SPACE_COUNT }, (_, i) => (
                      <th key={i + 1} className="text-center p-2 border-b font-medium text-muted-foreground w-8">
                        #{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {daysInMonth.map((day) => {
                    const dayOfWeek = getDay(day);
                    const dayName = DAY_NAMES[dayOfWeek];
                    const dayNum = format(day, 'd');
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                    return (
                      <tr key={day.toISOString()} className={isWeekend ? 'bg-muted/30' : ''}>
                        <td className="sticky left-0 bg-background z-10 p-2 border-b text-xs whitespace-nowrap">
                          <span className="font-medium">{dayName}</span>{' '}
                          <span className="text-muted-foreground">{dayNum}</span>
                        </td>
                        {Array.from({ length: SPACE_COUNT }, (_, i) => {
                          const spaceNum = i + 1;
                          const reservation = getReservation(day, spaceNum);

                          return (
                            <td
                              key={spaceNum}
                              className="p-1 border-b text-center cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleCellClick(day, spaceNum)}
                            >
                              {reservation && (
                                <div
                                  className={`w-3 h-3 rounded-full mx-auto ${statusColors[reservation.status]}`}
                                  title={`${reservation.status}: ${reservation.professional?.name || 'Unknown'}`}
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Confirmed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <span className="text-muted-foreground">Cancelled</span>
              </div>
            </div>
          </>
        )}

        {/* Reservation Details Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reservation Details</DialogTitle>
              <DialogDescription>
                {selectedReservation && (
                  <>Space #{selectedReservation.space_number} - {format(new Date(selectedReservation.reservation_date), 'EEEE, MMMM d, yyyy')}</>
                )}
              </DialogDescription>
            </DialogHeader>
            {selectedReservation && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-3 h-3 rounded-full ${statusColors[selectedReservation.status]}`} />
                      <span className="capitalize font-medium">{selectedReservation.status}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Professional</p>
                    <p className="font-medium mt-1">
                      {selectedReservation.professional?.name || 'Not assigned'}
                    </p>
                  </div>
                  {selectedReservation.professional?.email && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium mt-1">{selectedReservation.professional.email}</p>
                    </div>
                  )}
                  {selectedReservation.notes && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Notes</p>
                      <p className="mt-1">{selectedReservation.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}