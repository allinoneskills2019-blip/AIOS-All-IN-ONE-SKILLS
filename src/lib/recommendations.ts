import { getExperienceCategory } from './constants';
import { getTechnicianDistanceFromOrigin, type LatLng } from './geo';
import type { ServiceBooking, TechnicianProfile } from '../types';

export interface AiRecommendedTech {
  tech: TechnicianProfile;
  distanceKm: number | null;
  withinServiceRadius: boolean;
  matchedBookedSkill: string | null;
  bookedCountForSkill: number;
  zoneMatched: boolean;
  score: number;
  reason: string;
}

export interface ComputeRecommendationsParams {
  technicians: TechnicianProfile[];
  userBookings: ServiceBooking[];
  originCoords: LatLng | null;
  originZone: string | null;
  limit?: number;
}

export function computeAiRecommendedTechnicians({
  technicians,
  userBookings,
  originCoords,
  originZone,
  limit = 3,
}: ComputeRecommendationsParams): AiRecommendedTech[] {
  const availableTechs = technicians.filter((t) => t.availabilityStatus === 'Available');
  if (availableTechs.length === 0) return [];

  // Aggregate customer booking history signals (skills + repeat providers)
  const skillFrequency = new Map<string, number>();
  const bookedTechCount = new Map<string, number>();
  const validBookings = userBookings.filter(
    (b) => b.status !== 'Cancelled' && b.status !== 'Rejected'
  );

  for (const b of validBookings) {
    const weight = b.status === 'Completed' ? 2 : 1;
    if (b.skillCategory) {
      skillFrequency.set(b.skillCategory, (skillFrequency.get(b.skillCategory) || 0) + weight);
    }
    if (b.technicianId) {
      bookedTechCount.set(b.technicianId, (bookedTechCount.get(b.technicianId) || 0) + 1);
    }
  }

  const scored: AiRecommendedTech[] = availableTechs.map((tech) => {
    const distInfo = originCoords ? getTechnicianDistanceFromOrigin(originCoords, tech) : null;
    const distanceKm = distInfo ? distInfo.distanceKm : null;
    const withinServiceRadius = distInfo ? distInfo.withinServiceRadius : false;

    const exactZoneMatch = Boolean(
      originZone &&
        (tech.clusterZone === originZone ||
          (tech.preferredLocations || []).includes(originZone))
    );
    const zoneMatched = exactZoneMatch || withinServiceRadius;

    const bookedSkillScore = skillFrequency.get(tech.skillCategory) || 0;
    const matchedBookedSkill = bookedSkillScore > 0 ? tech.skillCategory : null;
    const repeatProviderVisits =
      bookedTechCount.get(tech.ownerId) || bookedTechCount.get(tech.id) || 0;

    // Scoring: prioritize combined Location/Zone match + Booking Skill match + Quality/Verification
    let score = 0;

    if (matchedBookedSkill) {
      score += 48 + Math.min(bookedSkillScore * 4, 16);
    }
    if (repeatProviderVisits > 0) {
      score += 12;
    }

    if (exactZoneMatch) {
      score += 36;
    } else if (withinServiceRadius && distanceKm !== null) {
      score += Math.max(18, 32 - distanceKm * 1.5);
    } else if (distanceKm !== null) {
      score += Math.max(0, 14 - distanceKm);
    }

    const grade =
      tech.adminGrade && tech.adminGrade !== 'Pending'
        ? tech.adminGrade
        : tech.experienceCategory || getExperienceCategory(tech.experienceYears);
    if (grade === 'A') score += 10;
    else if (grade === 'B') score += 6;
    else score += 3;

    if (tech.verified) score += 8;
    score += Number(tech.ratingAvg || 0) * 4;
    score += Math.min(Number(tech.completedJobsCount || 0), 10) * 0.5;

    // Human-readable grounded match reason
    const reasonParts: string[] = [];
    if (matchedBookedSkill && repeatProviderVisits > 0) {
      reasonParts.push(`Previously booked for ${matchedBookedSkill}`);
    } else if (matchedBookedSkill) {
      reasonParts.push(`Matches your past ${matchedBookedSkill} bookings`);
    }

    if (exactZoneMatch && originZone) {
      reasonParts.push(
        distanceKm !== null
          ? `Covers ${originZone} (${distanceKm.toFixed(1)} km away)`
          : `Active in ${originZone}`
      );
    } else if (withinServiceRadius && distanceKm !== null) {
      reasonParts.push(`Within ${tech.workingRadiusKm} km service radius (${distanceKm.toFixed(1)} km away)`);
    } else if (distanceKm !== null) {
      reasonParts.push(`${distanceKm.toFixed(1)} km from ${originZone || 'your location'}`);
    } else {
      reasonParts.push(`Serves ${tech.clusterZone} (${tech.workingRadiusKm} km radius)`);
    }

    if ((tech.ratingAvg ?? 0) >= 4.5 && (tech.ratingCount ?? 0) > 0) {
      reasonParts.push(`Rated ${tech.ratingAvg?.toFixed(1)}/5`);
    } else if (tech.verified) {
      reasonParts.push('Verified specialist');
    }

    return {
      tech,
      distanceKm,
      withinServiceRadius,
      matchedBookedSkill,
      bookedCountForSkill: bookedSkillScore,
      zoneMatched,
      score: Math.round(score),
      reason: reasonParts.join(' · '),
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    return da - db;
  });

  return scored.slice(0, limit);
}
