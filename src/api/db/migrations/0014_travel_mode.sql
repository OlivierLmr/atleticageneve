-- Not all athletes travel by plane — arrival/departure can also be by train
-- or by road. Each leg gets its own travel mode so an athlete can e.g. fly in
-- but take the train back. Flight-specific fields (arrival_flight,
-- departure_flight) only make sense when the mode is 'plane'.
ALTER TABLE athlete ADD COLUMN arrival_travel_mode TEXT NOT NULL DEFAULT 'plane';
ALTER TABLE athlete ADD COLUMN departure_travel_mode TEXT NOT NULL DEFAULT 'plane';
