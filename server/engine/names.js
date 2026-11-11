'use strict';

const FIRST_NAMES = [
  'Alejandro', 'Mateo', 'Diego', 'Lucas', 'Hugo', 'Pablo', 'Martín', 'Leo', 'Daniel', 'Pau',
  'Álvaro', 'Adrián', 'David', 'Javier', 'Sergio', 'Carlos', 'Marcos', 'Iker', 'Bruno', 'Izan',
  'Enzo', 'Liam', 'Noah', 'Rafael', 'Julián', 'Nico', 'Aitor', 'Unai', 'Gonzalo', 'Rodrigo',
  'Marco', 'Kevin', 'Yusuf', 'Amir', 'Luka', 'Ivan', 'Milan', 'Tomas', 'Pierre', 'Antoine',
  'Kylian', 'Ousmane', 'Moussa', 'Ibrahim', 'Karim', 'Youssef', 'Rafinha', 'João', 'Diogo', 'Rúben'
];

const LAST_NAMES = [
  'García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Fernández', 'Ruiz', 'Díaz', 'Moreno',
  'Álvarez', 'Romero', 'Navarro', 'Torres', 'Domínguez', 'Vargas', 'Castillo', 'Ortiz', 'Ramos', 'Iglesias',
  'Herrera', 'Medina', 'Aguilar', 'Cabrera', 'Reyes', 'Silva', 'Costa', 'Santos', 'Oliveira', 'Pereira',
  'Kovač', 'Novak', 'Horvat', 'Marić', 'Dubois', 'Lefèvre', 'Moreau', 'Girard', 'Mensah', 'Diallo',
  'Traoré', 'Keita', 'Okafor', 'Hassan', 'Farouk', 'Yilmaz', 'Demir', 'Rossi', 'Ferrari', 'Bianchi'
];

const CITIES = [
  'Vallebravo', 'Puerto Lumen', 'San Adriano', 'Costa Doria', 'Monte Real', 'Río Verde',
  'Villa Nova', 'El Portillo', 'Santa Elena', 'La Cañada', 'Torreblanca', 'Miramar',
  'Alta Mar', 'Fuentevieja', 'Peñas Negras', 'Bahía Sol'
];

const CLUB_SUFFIX = ['CF', 'FC', 'UD', 'Atlético', 'Real', 'Deportivo', 'CD', 'Unión'];

const SPONSOR_NAMES = [
  'AeroVolt', 'NovaBank', 'Cerveza Dorada', 'TeleSur', 'MaxiMart', 'Fintia', 'TurboFuel',
  'Zapatón', 'Café Andino', 'SeguraSeg', 'PixelPlay', 'Orbitel'
];

function randomName(rng) {
  return rng.pick(FIRST_NAMES) + ' ' + rng.pick(LAST_NAMES);
}

module.exports = { FIRST_NAMES, LAST_NAMES, CITIES, CLUB_SUFFIX, SPONSOR_NAMES, randomName };
