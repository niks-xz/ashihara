import type { ImageMetadata } from 'astro';
import type { CollectionEntry } from 'astro:content';
import placeholderMale from '../assets/coaches/placeholder-male.jpg';
import placeholderFemale from '../assets/coaches/placeholder-female.jpg';

// Фото тренера, а пока его нет - рисованный каратист по полу
export function coachPhoto(coach: CollectionEntry<'coaches'>): ImageMetadata {
  if (coach.data.photo) {
    return coach.data.photo;
  }
  return coach.data.gender === 'female' ? placeholderFemale : placeholderMale;
}
