import type { ImageMetadata } from 'astro';
import type { CollectionEntry } from 'astro:content';
import placeholderMale from '../assets/coaches/placeholder-male.jpg';
import placeholderFemaleFair from '../assets/coaches/placeholder-female-fair.jpg';
import placeholderFemaleRed from '../assets/coaches/placeholder-female-red.jpg';

type Coach = CollectionEntry<'coaches'>;

const placeholders: Record<Coach['data']['placeholder'], ImageMetadata> = {
  male: placeholderMale,
  'female-fair': placeholderFemaleFair,
  'female-red': placeholderFemaleRed,
};

// Фото тренера, а пока его нет - рисованная заглушка из карточки тренера
export function coachPhoto(coach: Coach): ImageMetadata {
  return coach.data.photo ?? placeholders[coach.data.placeholder];
}
