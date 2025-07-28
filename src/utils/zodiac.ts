export interface ZodiacSign {
  name: string;
  nameRu: string;
  symbol: string;
  element: string;
  dates: string;
}

export const zodiacSigns: ZodiacSign[] = [
  { name: 'Aries', nameRu: 'Овен', symbol: '♈', element: 'Огонь', dates: '21 марта - 19 апреля' },
  { name: 'Taurus', nameRu: 'Телец', symbol: '♉', element: 'Земля', dates: '20 апреля - 20 мая' },
  { name: 'Gemini', nameRu: 'Близнецы', symbol: '♊', element: 'Воздух', dates: '21 мая - 20 июня' },
  { name: 'Cancer', nameRu: 'Рак', symbol: '♋', element: 'Вода', dates: '21 июня - 22 июля' },
  { name: 'Leo', nameRu: 'Лев', symbol: '♌', element: 'Огонь', dates: '23 июля - 22 августа' },
  { name: 'Virgo', nameRu: 'Дева', symbol: '♍', element: 'Земля', dates: '23 августа - 22 сентября' },
  { name: 'Libra', nameRu: 'Весы', symbol: '♎', element: 'Воздух', dates: '23 сентября - 22 октября' },
  { name: 'Scorpio', nameRu: 'Скорпион', symbol: '♏', element: 'Вода', dates: '23 октября - 21 ноября' },
  { name: 'Sagittarius', nameRu: 'Стрелец', symbol: '♐', element: 'Огонь', dates: '22 ноября - 21 декабря' },
  { name: 'Capricorn', nameRu: 'Козерог', symbol: '♑', element: 'Земля', dates: '22 декабря - 19 января' },
  { name: 'Aquarius', nameRu: 'Водолей', symbol: '♒', element: 'Воздух', dates: '20 января - 18 февраля' },
  { name: 'Pisces', nameRu: 'Рыбы', symbol: '♓', element: 'Вода', dates: '19 февраля - 20 марта' }
];

export function calculateZodiacSign(birthDate: string): ZodiacSign | null {
  const date = new Date(birthDate);
  if (isNaN(date.getTime())) return null;

  const month = date.getMonth() + 1;
  const day = date.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return zodiacSigns[0]; // Aries
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return zodiacSigns[1]; // Taurus
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return zodiacSigns[2]; // Gemini
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return zodiacSigns[3]; // Cancer
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return zodiacSigns[4]; // Leo
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return zodiacSigns[5]; // Virgo
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return zodiacSigns[6]; // Libra
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return zodiacSigns[7]; // Scorpio
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return zodiacSigns[8]; // Sagittarius
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return zodiacSigns[9]; // Capricorn
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return zodiacSigns[10]; // Aquarius
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return zodiacSigns[11]; // Pisces

  return null;
}

export function formatBirthDate(birthDate: string): string {
  const date = new Date(birthDate);
  if (isNaN(date.getTime())) return birthDate;
  
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}