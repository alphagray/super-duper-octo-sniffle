/**
 * Assignment for a seat in a section
 */
export interface SeatAssignment {
  sectionId: string;
  row: number;
  seat: number;
  occupied: boolean;
  fanType?: string;
  fanProperties?: any;
}
