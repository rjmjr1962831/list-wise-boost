-- Create parking space reservations table
CREATE TABLE public.parking_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_number INTEGER NOT NULL CHECK (space_number >= 1 AND space_number <= 12),
  reservation_date DATE NOT NULL,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(space_number, reservation_date)
);

-- Enable RLS
ALTER TABLE public.parking_reservations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage reservations"
  ON public.parking_reservations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view reservations"
  ON public.parking_reservations
  FOR SELECT
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_parking_reservations_updated_at
  BEFORE UPDATE ON public.parking_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();