import { STORAGE } from "../../data/amazonFees";

export type StorageInput = {
  lengthCm: number; widthCm: number; heightCm: number;
  units: number;
  monthlySales: number;   // units sold per month
  peakSeason: boolean;    // Oct–Dec higher rate
  daysInStock: number;    // age of current inventory
};

export type StorageResult = {
  unitVolumeCuFt: number;
  totalVolumeCuFt: number;
  ratePerCuFt: number;
  monthlyStorage: number;
  monthsOfCover: number;
  aged: boolean;
  agedSurcharge: number;
  totalMonthlyExposure: number;
};

const CM3_PER_CUFT = 28316.8466;

export function calculateStorage(i: StorageInput): StorageResult {
  const unitVolCm3 = (i.lengthCm || 0) * (i.widthCm || 0) * (i.heightCm || 0);
  const unitVolumeCuFt = unitVolCm3 / CM3_PER_CUFT;
  const totalVolumeCuFt = unitVolumeCuFt * (i.units || 0);

  const ratePerCuFt = i.peakSeason ? STORAGE.perCubicFootPeak : STORAGE.perCubicFootStandard;
  const monthlyStorage = totalVolumeCuFt * ratePerCuFt;

  const monthsOfCover = i.monthlySales > 0 ? (i.units || 0) / i.monthlySales : Infinity;

  const aged = (i.daysInStock || 0) > 365;
  const agedSurcharge = aged ? totalVolumeCuFt * STORAGE.agedSurchargePerCubicFoot : 0;

  return {
    unitVolumeCuFt, totalVolumeCuFt, ratePerCuFt, monthlyStorage,
    monthsOfCover, aged, agedSurcharge,
    totalMonthlyExposure: monthlyStorage + agedSurcharge,
  };
}
