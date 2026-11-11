'use strict';

const COUNTRIES = [
  {
    code: 'es', name: 'España', flag: '🇪🇸',
    first: ['Alejandro', 'Mateo', 'Diego', 'Lucas', 'Hugo', 'Pablo', 'Martín', 'Daniel', 'Sergio', 'Álvaro', 'Adrián', 'Javier', 'Iker', 'Unai', 'Gonzalo', 'Rodrigo'],
    last: ['García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Gómez', 'Fernández', 'Ruiz', 'Díaz', 'Moreno', 'Álvarez', 'Romero', 'Navarro', 'Torres', 'Ramos', 'Iglesias']
  },
  {
    code: 'ar', name: 'Argentina', flag: '🇦🇷',
    first: ['Lautaro', 'Julián', 'Enzo', 'Nicolás', 'Facundo', 'Thiago', 'Valentín', 'Emiliano', 'Cristian', 'Matías', 'Franco', 'Agustín', 'Joaquín', 'Bruno', 'Santiago', 'Gonzalo'],
    last: ['Fernández', 'Rodríguez', 'González', 'Álvarez', 'Romero', 'Martínez', 'Paredes', 'Molina', 'Correa', 'Domínguez', 'Palacios', 'Mac Allister', 'Lo Celso', 'Pezzella', 'Ocampos', 'Garnacho']
  },
  {
    code: 'br', name: 'Brasil', flag: '🇧🇷',
    first: ['João', 'Pedro', 'Gabriel', 'Lucas', 'Matheus', 'Rafael', 'Vinícius', 'Rodrygo', 'Éder', 'Bruno', 'Caio', 'Everton', 'Wesley', 'Danilo', 'Igor', 'Murilo'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa', 'Almeida', 'Ferreira', 'Ribeiro', 'Barbosa', 'Cardoso', 'Gomes', 'Martins', 'Rocha', 'Nunes', 'Lima']
  },
  {
    code: 'en', name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    first: ['Harry', 'Jack', 'Jude', 'Bukayo', 'Declan', 'Marcus', 'Phil', 'Ollie', 'Reece', 'Trent', 'Callum', 'Mason', 'Jarrod', 'Dominic', 'Cole', 'Levi'],
    last: ['Smith', 'Jones', 'Walker', 'Foden', 'Rice', 'Kane', 'Sterling', 'Grealish', 'Watkins', 'Trippier', 'Alexander-Arnold', 'Maddison', 'Bowen', 'Wilson', 'Palmer', 'Colwill']
  },
  {
    code: 'fr', name: 'Francia', flag: '🇫🇷',
    first: ['Kylian', 'Antoine', 'Ousmane', 'Aurélien', 'Jules', 'Théo', 'Randal', 'Christopher', 'Warren', 'Eduardo', 'Youssouf', 'Lucas', 'Benjamin', 'Manu', 'Adrien', 'Loïc'],
    last: ['Dubois', 'Lefèvre', 'Moreau', 'Girard', 'Kolo Muani', 'Dembélé', 'Camavinga', 'Konaté', 'Upamecano', 'Zaïre-Emery', 'Fofana', 'Hernández', 'Pavard', 'Rabiot', 'Thuram', 'Nkunku']
  },
  {
    code: 'de', name: 'Alemania', flag: '🇩🇪',
    first: ['Jamal', 'Florian', 'Kai', 'Joshua', 'Leon', 'Serge', 'Niklas', 'Robin', 'Maximilian', 'Felix', 'Lukas', 'Jonas', 'Tim', 'Marvin', 'Nico', 'Elias'],
    last: ['Müller', 'Schmidt', 'Wirtz', 'Havertz', 'Kimmich', 'Goretzka', 'Süle', 'Gosens', 'Mittelstädt', 'Nmecha', 'Klain', 'Hofmann', 'Kleindienst', 'Wolf', 'Schlotterbeck', 'Grimaldo']
  },
  {
    code: 'it', name: 'Italia', flag: '🇮🇹',
    first: ['Nicolò', 'Federico', 'Lorenzo', 'Giacomo', 'Davide', 'Alessandro', 'Matteo', 'Riccardo', 'Gianluca', 'Samuele', 'Andrea', 'Marco', 'Simone', 'Tommaso', 'Michele', 'Cristian'],
    last: ['Rossi', 'Ferrari', 'Bianchi', 'Barella', 'Chiesa', 'Pellegrini', 'Frattesi', 'Scamacca', 'Zaniolo', 'Bastoni', 'Cambiaso', 'Retegui', 'Ricci', 'Baldanzi', 'Colombo', 'Gatti']
  },
  {
    code: 'pt', name: 'Portugal', flag: '🇵🇹',
    first: ['João', 'Diogo', 'Rúben', 'Gonçalo', 'Bernardo', 'Rafael', 'Pedro', 'Nuno', 'Vitinha', 'Fábio', 'Otávio', 'Tiago', 'Ricardo', 'André', 'Daniel', 'Francisco'],
    last: ['Silva', 'Fernandes', 'Neves', 'Ramos', 'Dias', 'Leão', 'Dalot', 'Trincão', 'Conceição', 'Semedo', 'Moutinho', 'Palhinha', 'Veiga', 'Inácio', 'Todibo', 'Costa']
  },
  {
    code: 'nl', name: 'Países Bajos', flag: '🇳🇱',
    first: ['Cody', 'Virgil', 'Frenkie', 'Memphis', 'Xavi', 'Ryan', 'Jurriën', 'Denzel', 'Steven', 'Teun', 'Micky', 'Donyell', 'Quinten', 'Brian', 'Joshua', 'Lutsharel'],
    last: ['Gakpo', 'Van Dijk', 'De Jong', 'Depay', 'Simons', 'Gravenberch', 'Timber', 'Dumfries', 'Bergwijn', 'Koopmeiners', 'Van de Ven', 'Malen', 'Brobbey', 'Zirkzee', 'Geertruida', 'Weghorst']
  },
  {
    code: 'uy', name: 'Uruguay', flag: '🇺🇾',
    first: ['Federico', 'Darwin', 'Facundo', 'Manuel', 'Nicolás', 'Rodrigo', 'Brian', 'Maxi', 'Agustín', 'Emiliano', 'Sebastián', 'Mathías', 'Diego', 'Santiago', 'Cristian', 'Ignacio'],
    last: ['Valverde', 'Núñez', 'Pellistri', 'Ugarte', 'De la Cruz', 'Bentancur', 'Araújo', 'Olivera', 'Sánchez', 'Canobbio', 'Gómez', 'Cáceres', 'Rodríguez', 'Viña', 'Rossi', 'Bueno']
  },
  {
    code: 'mx', name: 'México', flag: '🇲🇽',
    first: ['Santiago', 'Hirving', 'Alexis', 'Edson', 'César', 'Luis', 'Diego', 'Roberto', 'Julián', 'Uriel', 'Jesús', 'Erick', 'Jorge', 'Kevin', 'Israel', 'Obed'],
    last: ['Giménez', 'Lozano', 'Vega', 'Álvarez', 'Montes', 'Chávez', 'Lainez', 'Alvarado', 'Quiñones', 'Antuna', 'Ochoa', 'Reyes', 'Vargas', 'Romo', 'Sandoval', 'Márquez']
  },
  {
    code: 'ng', name: 'Nigeria', flag: '🇳🇬',
    first: ['Victor', 'Samuel', 'Ademola', 'Wilfred', 'Alex', 'Calvin', 'Frank', 'Kelechi', 'Terem', 'Bright', 'Zaidu', 'Peter', 'Cyriel', 'Joe', 'Bruno', 'Alhassan'],
    last: ['Osimhen', 'Chukwueze', 'Lookman', 'Ndidi', 'Iwobi', 'Bassey', 'Onyeka', 'Aina', 'Moffi', 'Osayi-Samuel', 'Sanusi', 'Ebiowei', 'Dessers', 'Aribo', 'Onomacho', 'Yusuf']
  }
];

const COUNTRY_MAP = {};
for (const c of COUNTRIES) COUNTRY_MAP[c.code] = c;

const DEFAULT_COUNTRY = 'es';

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

const SPONSOR_SECTORS = [
  'Aerolíneas', 'Banca', 'Bebidas', 'Telecomunicaciones', 'Retail', 'Fintech',
  'Energía', 'Deporte', 'Café', 'Seguros', 'Videojuegos', 'Telefonía'
];

function countryOf(code) {
  return COUNTRY_MAP[code] || COUNTRY_MAP[DEFAULT_COUNTRY];
}

function randomName(rng, countryCode) {
  const c = countryOf(countryCode);
  return rng.pick(c.first) + ' ' + rng.pick(c.last);
}

module.exports = {
  COUNTRIES, COUNTRY_MAP, DEFAULT_COUNTRY, CITIES, CLUB_SUFFIX,
  SPONSOR_NAMES, SPONSOR_SECTORS, randomName, countryOf
};
