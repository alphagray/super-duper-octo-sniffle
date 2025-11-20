/**
 * Represents a section of the stadium with fan engagement metrics
 */
export interface Section {
  /** Unique identifier for the section */
  id: string;
  /** Happiness level of fans in this section (0-100) */
  happiness: number;
  /** Thirst level of fans in this section (0-100) */
  thirst: number;
  /** Attention level of fans in this section (0-100) */
  attention: number;
  /** Environmental modifier for thirst (< 1.0 = shade, 1.0 = normal, > 1.0 = hot/sunny) */
  environmentalModifier: number;
}

/**
 * Configuration for a stadium section
 */
export interface SectionConfig {
  rowCount?: number;
  seatsPerRow?: number;
  width: number;
  height: number;
  rowBaseHeightPercent?: number;
  startLightness?: number;
  autoPopulate?: boolean;
}
