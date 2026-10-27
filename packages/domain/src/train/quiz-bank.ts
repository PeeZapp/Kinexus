export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: readonly string[];
  answer: number;
};

type Food = { label: string; kcal: number };
type Scored = { label: string; score: number };

const FOODS: readonly Food[] = [
  { label: '1 medium apple', kcal: 95 },
  { label: '1 medium banana', kcal: 105 },
  { label: '1 cup of strawberries', kcal: 50 },
  { label: '1 cup of blueberries', kcal: 85 },
  { label: '1 medium orange', kcal: 65 },
  { label: '1 cup of grapes', kcal: 105 },
  { label: '1 medium avocado', kcal: 240 },
  { label: '1 cup of cooked white rice', kcal: 205 },
  { label: '1 cup of cooked brown rice', kcal: 215 },
  { label: '1 cup of cooked pasta', kcal: 220 },
  { label: '1 medium baked potato', kcal: 160 },
  { label: '1 cup of mashed potato', kcal: 220 },
  { label: '1 slice of white bread', kcal: 80 },
  { label: '1 slice of wholemeal bread', kcal: 90 },
  { label: '1 plain bagel', kcal: 270 },
  { label: '1 cup of cooked oats', kcal: 150 },
  { label: '1 cup of cornflakes', kcal: 100 },
  { label: '1 tablespoon of peanut butter', kcal: 95 },
  { label: '1 tablespoon of olive oil', kcal: 120 },
  { label: '1 tablespoon of butter', kcal: 100 },
  { label: '1 large egg', kcal: 70 },
  { label: '100 g cooked chicken breast', kcal: 165 },
  { label: '100 g cooked salmon', kcal: 200 },
  { label: '100 g lean cooked beef', kcal: 200 },
  { label: '1 small can of tuna in water', kcal: 100 },
  { label: '1 cup of whole milk', kcal: 150 },
  { label: '1 cup of skim milk', kcal: 85 },
  { label: '1 cup of orange juice', kcal: 110 },
  { label: '1 can of cola (375 ml)', kcal: 160 },
  { label: '1 cup of black coffee', kcal: 2 },
  { label: '1 glass of wine (150 ml)', kcal: 125 },
  { label: '1 can of beer (375 ml)', kcal: 150 },
  { label: '1 doughnut', kcal: 250 },
  { label: '1 slice of cheese pizza', kcal: 285 },
  { label: '1 small cheeseburger', kcal: 300 },
  { label: 'a medium serve of hot chips', kcal: 340 },
  { label: '1 scoop of vanilla ice cream', kcal: 140 },
  { label: '1 chocolate bar (50 g)', kcal: 260 },
  { label: '30 g of almonds', kcal: 175 },
  { label: '1 cup of broccoli', kcal: 55 },
  { label: '1 cup of raw spinach', kcal: 7 },
  { label: '1 cup of cooked lentils', kcal: 230 },
  { label: '1 cup of cooked chickpeas', kcal: 270 },
  { label: '1 cup of plain low-fat Greek yogurt', kcal: 140 },
  { label: '1 cup of fruit yogurt', kcal: 220 },
  { label: '1 croissant', kcal: 270 },
  { label: '1 large muffin', kcal: 370 },
  { label: '1 slice of cheddar', kcal: 115 },
  { label: '1 cup of cottage cheese', kcal: 180 },
  { label: '100 g firm tofu', kcal: 80 },
  { label: '1 tablespoon of honey', kcal: 65 },
  { label: '1 medium pear', kcal: 100 },
  { label: '1 cup of watermelon', kcal: 45 },
  { label: '1 cup of cooked quinoa', kcal: 220 },
  { label: '1 medium sweet potato', kcal: 100 },
  { label: '1 tablespoon of mayonnaise', kcal: 90 },
  { label: '1 tablespoon of tomato sauce', kcal: 20 },
  { label: '1 packet of instant noodles', kcal: 380 },
  { label: '1 plain rice cake', kcal: 35 },
  { label: '1 medium carrot', kcal: 25 },
  { label: '1 cup of sliced cucumber', kcal: 16 },
  { label: 'a small bag of crisps (25 g)', kcal: 130 },
  { label: '1 chocolate chip cookie', kcal: 160 },
  { label: '1 scoop of protein powder', kcal: 120 },
  { label: '1 regular latte with whole milk', kcal: 180 },
  { label: '1 cup of air-popped popcorn', kcal: 30 },
  { label: '1 flour tortilla', kcal: 150 },
  { label: '1 naan bread', kcal: 260 },
  { label: '1/2 cup of granola', kcal: 210 },
  { label: '2 tablespoons of hummus', kcal: 70 },
  { label: '1 pork sausage', kcal: 180 },
  { label: '2 rashers of bacon', kcal: 90 },
  { label: '100 g grilled white fish', kcal: 115 },
  { label: '1 cup of edamame', kcal: 190 },
  { label: '100 g cooked prawns', kcal: 100 },
  { label: '1 tablespoon of cream cheese', kcal: 50 },
  { label: '1 sports drink (600 ml)', kcal: 150 },
  { label: '1 cup of coconut water', kcal: 45 },
  { label: '1 cup of pineapple', kcal: 80 },
  { label: '1 glass of apple juice (250 ml)', kcal: 115 },
];

const BURNS: readonly Scored[] = [
  { label: '30 minutes of sitting', score: 1 },
  { label: '30 minutes of gentle stretching', score: 2 },
  { label: '30 minutes of easy walking', score: 3 },
  { label: '30 minutes of yoga', score: 4 },
  { label: '30 minutes of brisk walking', score: 5 },
  { label: '30 minutes of casual cycling', score: 6 },
  { label: '30 minutes of jogging', score: 8 },
  { label: '30 minutes of swimming laps', score: 8 },
  { label: '30 minutes of running', score: 9 },
  { label: '30 minutes of jumping rope', score: 9 },
];

type Lift = { name: string; muscle: string; pattern: string; tool: string };

const LIFTS: readonly Lift[] = [
  { name: 'flat bench press', muscle: 'chest', pattern: 'push', tool: 'a barbell' },
  { name: 'dumbbell bench press', muscle: 'chest', pattern: 'push', tool: 'dumbbells' },
  { name: 'push-up', muscle: 'chest', pattern: 'push', tool: 'your body weight' },
  { name: 'dip', muscle: 'chest', pattern: 'push', tool: 'your body weight' },
  { name: 'cable fly', muscle: 'chest', pattern: 'push', tool: 'a cable' },
  { name: 'incline dumbbell press', muscle: 'chest', pattern: 'push', tool: 'dumbbells' },
  { name: 'lat pulldown', muscle: 'back', pattern: 'pull', tool: 'a cable' },
  { name: 'seated row', muscle: 'back', pattern: 'pull', tool: 'a cable' },
  { name: 'pull-up', muscle: 'back', pattern: 'pull', tool: 'your body weight' },
  { name: 'bent-over barbell row', muscle: 'back', pattern: 'pull', tool: 'a barbell' },
  { name: 'single-arm dumbbell row', muscle: 'back', pattern: 'pull', tool: 'a dumbbell' },
  { name: 'chest-supported row', muscle: 'back', pattern: 'pull', tool: 'dumbbells' },
  { name: 'back squat', muscle: 'quads', pattern: 'squat', tool: 'a barbell' },
  { name: 'front squat', muscle: 'quads', pattern: 'squat', tool: 'a barbell' },
  { name: 'goblet squat', muscle: 'quads', pattern: 'squat', tool: 'a dumbbell' },
  { name: 'leg press', muscle: 'quads', pattern: 'squat', tool: 'a machine' },
  { name: 'walking lunge', muscle: 'quads', pattern: 'squat', tool: 'dumbbells' },
  { name: 'Bulgarian split squat', muscle: 'quads', pattern: 'squat', tool: 'dumbbells' },
  { name: 'leg extension', muscle: 'quads', pattern: 'squat', tool: 'a machine' },
  { name: 'Romanian deadlift', muscle: 'hamstrings', pattern: 'hinge', tool: 'a barbell' },
  { name: 'dumbbell Romanian deadlift', muscle: 'hamstrings', pattern: 'hinge', tool: 'dumbbells' },
  { name: 'lying leg curl', muscle: 'hamstrings', pattern: 'hinge', tool: 'a machine' },
  { name: 'conventional deadlift', muscle: 'hips and back', pattern: 'hinge', tool: 'a barbell' },
  { name: 'hip thrust', muscle: 'glutes', pattern: 'hinge', tool: 'a barbell' },
  { name: 'glute bridge', muscle: 'glutes', pattern: 'hinge', tool: 'your body weight' },
  { name: 'cable pull-through', muscle: 'glutes', pattern: 'hinge', tool: 'a cable' },
  { name: 'overhead press', muscle: 'shoulders', pattern: 'push', tool: 'a barbell' },
  { name: 'dumbbell shoulder press', muscle: 'shoulders', pattern: 'push', tool: 'dumbbells' },
  { name: 'lateral raise', muscle: 'shoulders', pattern: 'push', tool: 'dumbbells' },
  { name: 'rear-delt fly', muscle: 'shoulders', pattern: 'pull', tool: 'dumbbells' },
  { name: 'face pull', muscle: 'shoulders', pattern: 'pull', tool: 'a cable' },
  { name: 'barbell curl', muscle: 'biceps', pattern: 'pull', tool: 'a barbell' },
  { name: 'dumbbell curl', muscle: 'biceps', pattern: 'pull', tool: 'dumbbells' },
  { name: 'hammer curl', muscle: 'biceps', pattern: 'pull', tool: 'dumbbells' },
  { name: 'incline dumbbell curl', muscle: 'biceps', pattern: 'pull', tool: 'dumbbells' },
  { name: 'triceps pushdown', muscle: 'triceps', pattern: 'push', tool: 'a cable' },
  { name: 'overhead triceps extension', muscle: 'triceps', pattern: 'push', tool: 'a dumbbell' },
  { name: 'close-grip bench press', muscle: 'triceps', pattern: 'push', tool: 'a barbell' },
  { name: 'skull crusher', muscle: 'triceps', pattern: 'push', tool: 'a barbell' },
  { name: 'plank', muscle: 'core', pattern: 'core', tool: 'your body weight' },
  { name: 'dead bug', muscle: 'core', pattern: 'core', tool: 'your body weight' },
  { name: 'hanging knee raise', muscle: 'core', pattern: 'core', tool: 'your body weight' },
  { name: 'cable crunch', muscle: 'core', pattern: 'core', tool: 'a cable' },
  { name: 'ab wheel rollout', muscle: 'core', pattern: 'core', tool: 'an ab wheel' },
  { name: 'standing calf raise', muscle: 'calves', pattern: 'squat', tool: 'a machine' },
  { name: 'seated calf raise', muscle: 'calves', pattern: 'squat', tool: 'a machine' },
  { name: 'farmer carry', muscle: 'grip', pattern: 'carry', tool: 'dumbbells' },
];

const FACTS: readonly [string, string, string, string][] = [
  ['How long do most work sets rest?', 'About 1–2 minutes', 'About 10 seconds', 'About 10 minutes'],
  ['Which nutrient rebuilds muscle after training?', 'Protein', 'Only added sugar', 'Only caffeine'],
  ['What should you do before a heavy squat or deadlift?', 'Brace your trunk', 'Hold your breath for the whole set', 'Lock the knees first'],
  ['How should the lowering part of a rep feel?', 'Controlled', 'Dropped', 'Bounced at the bottom'],
  ['A warm-up set is usually…', 'Lighter than your work sets', 'Heavier than your work sets', 'Skipped when you are late'],
  ['A sharp pain in a joint means…', 'Stop that exercise', 'Add weight', 'Hold the stretch and bounce'],
  ['The usual drink during a gym session is…', 'Water', 'Juice only', 'Nothing until you finish'],
  ['A lot of recovery happens when you…', 'Sleep', 'Skip the next meal', 'Train the same muscle again immediately'],
  ['Vegetables mainly add…', 'Fibre and micronutrients', 'Only extra sugar', 'A replacement for every meal'],
  ['On a press, the wrists should stay…', 'Stacked over the forearms', 'Bent hard back', 'Tucked under the bar'],
  ['A superset means you…', 'Pair exercises with little rest between them', 'Rest five minutes between every rep', 'Only train one muscle all week'],
  ['Progressive overload means you…', 'Gradually ask more of the muscle', 'Use the same weight forever', 'Skip the last set'],
  ['The last reps of a work set should usually feel…', 'Hard, with a rep or two left', 'Impossible to move at all, every set', 'As easy as the empty bar'],
  ['To keep a bar path steady on a squat, the knees generally track…', 'Over the mid-foot', 'Well inside the ankles', 'Locked straight the whole way'],
  ['On a bench press, the shoulder blades are usually…', 'Pulled down and together', 'Shrugged up by the ears', 'Loose and moving every rep'],
  ['A deadlift is finished when…', 'You are standing tall with the bar in hand', 'The bar is still below the knees', 'You lean far back and overextend'],
  ['Eccentric means the muscle is…', 'Lengthening under load', 'Doing nothing', 'Only holding a stretch with no control'],
  ['A rest day for a trained muscle is useful because…', 'Tissue repairs between sessions', 'Muscles shrink if you ever rest', 'You should train that muscle every waking hour'],
  ['Frying food usually adds calories because…', 'The food soaks up oil', 'Heat deletes calories', 'The pan removes fat'],
  ['Grilling chicken instead of deep-frying it usually…', 'Keeps the calories lower', 'Doubles the protein into fat', 'Removes the need to eat'],
  ['Liquid calories are easy to overdo because…', 'Drinks are less filling than the same calories in food', 'Liquids have no calories', 'Water is the same as juice'],
  ['Alcohol adds calories and…', 'Does not build muscle', 'Counts as a protein serving', 'Replaces sleep'],
  ['A useful protein food at a meal is…', 'Eggs, yoghurt, meat, fish, tofu, or legumes', 'Only boiled lollies', 'Only diet soft drink'],
  ['Fibre is mainly found in…', 'Vegetables, fruit, legumes, and whole grains', 'Only butter', 'Only sports drinks'],
  ['Iron from plants is absorbed better with…', 'A source of vitamin C', 'A large glass of tea with the meal', 'Skipping the meal'],
  ['Calcium is easy to find in…', 'Dairy, fortified drinks, tofu, and some greens', 'Only boiled sweets', 'Only black coffee'],
  ['A calorie deficit means you…', 'Eat a bit less energy than you use', 'Must stop eating protein', 'Double every meal'],
  ['Building muscle is easier when you…', 'Lift and eat enough protein', 'Only stretch and skip meals', 'Train fasted and never sleep'],
  ['Added sugar is energy that…', 'Does not replace protein or vegetables', 'Counts as a serving of vegetables', 'Builds muscle on its own'],
  ['Olive oil is useful in cooking and…', 'Still high in calories by the spoon', 'Calorie-free because it is a plant', 'A protein source'],
  ['Nuts are nutritious and…', 'Easy to overeat because they are energy-dense', 'A free food with almost no calories', 'Only a source of vitamin C'],
  ['Air-popped popcorn is usually lighter in calories than…', 'The same volume of crisps', 'A bowl of plain broccoli', 'Black coffee'],
  ['A sports drink is most relevant when…', 'You have been sweating through a long hard session', 'You are sitting at a desk', 'You want a meal replacement every hour'],
  ['Creatine is a common supplement that…', 'Supports repeated hard efforts for many people', 'Replaces every meal', 'Is the same thing as caffeine'],
  ['Caffeine can…', 'Make a session feel easier for some people', 'Replace water', 'Build muscle without training'],
  ['The best shoes for a heavy squat are often…', 'Flat and stable', 'Thickly cushioned and wobbly', 'Untied'],
  ['Breathing on a heavy brace is usually…', 'A breath held behind a tight trunk, then reset', 'Fast panting through every rep', 'No breath at all for the whole workout'],
  ['If a rep’s form breaks down, you should…', 'End the set or take weight off', 'Bounce harder', 'Add weight immediately'],
  ['A longer muscle group like the back can be trained with…', 'Pulls and rows', 'Only calf raises', 'Only wrist curls'],
  ['Quads are trained hard by…', 'Squats, lunges, and leg press', 'Only wrist curls', 'Only side bends'],
  ['Hamstrings are trained hard by…', 'Hip hinges and leg curls', 'Only lateral raises', 'Only calf raises'],
  ['A row should be felt mainly in the…', 'Back, with the shoulder blade moving', 'Neck, by shrugging', 'Toes'],
  ['A push-up is easier when you…', 'Raise your hands on a bench', 'Put your feet on a high box', 'Sag through the hips'],
  ['To make a lunge harder you can…', 'Hold a weight or lengthen the step', 'Hold the wall and hop', 'Lock the front knee past a bounce'],
  ['A warm muscle is ready when you have…', 'Done light sets of the movement', 'Sat still for an hour', 'Stretched cold into pain'],
  ['Soreness the next day…', 'Is not required for a session to count', 'Proves you must train that muscle again immediately', 'Means you should chase pain'],
  ['A personal record is more meaningful when…', 'The reps are honest and the range is the same', 'You bounce the weight and shorten the rep', 'Someone else lifts it'],
  ['Cardio and lifting can fit in one week if you…', 'Leave enough recovery for hard days', 'Run a hard session before every max lift', 'Never walk'],
  ['A simple plate is built from…', 'Protein, plants, and a carb or fat you planned', 'Only sauce', 'Only dessert'],
  ['Salt and sauce change a meal because…', 'They can add a lot of calories or sodium', 'They erase the calories in the food', 'They turn chips into vegetables'],
  ['Whole fruit usually beats juice because…', 'It is more filling for the calories', 'Juice has no sugar', 'Fruit has no fibre'],
  ['Greek yogurt is useful after training because…', 'It brings protein', 'It is only sugar', 'It replaces sleep'],
  ['Chicken breast is leaner than the same weight of…', 'Most sausages', 'Raw spinach', 'Black coffee'],
  ['Salmon brings protein and…', 'More fat, and more calories, than white fish', 'No useful nutrition', 'The same calories as cucumber'],
  ['Legumes such as lentils and chickpeas…', 'Bring protein, fibre, and carbohydrates', 'Are calorie-free', 'Replace water'],
  ['Tofu is a…', 'Protein food made from soy', 'Kind of bread', 'Calorie-free oil'],
  ['A bagel is often…', 'Much more energy than one slice of bread', 'The same as a rice cake', 'Lower in calories than black coffee'],
  ['Granola is often…', 'Denser in calories than a bowl of plain oats', 'Mostly water', 'A vegetable'],
  ['Instant noodles are often…', 'A high-calorie packet once the oil is included', 'A low-calorie vegetable meal', 'Mostly protein'],
  ['A muffin from a cafe is often…', 'Closer to cake than to a piece of fruit', 'The same calories as a carrot', 'A protein serving'],
  ['Hot chips are high in calories mainly because…', 'They are fried', 'Potato has no energy until it is boiled', 'Salt removes calories'],
  ['Ice cream is…', 'A treat with more calories than the same volume of berries', 'A serving of vegetables', 'Calorie-free when frozen'],
  ['Cheese is…', 'A compact source of calories and protein', 'Mostly water like cucumber', 'A fruit'],
  ['If you are very hungry after training, a better default is…', 'A meal with protein and plants', 'Only a large soft drink', 'Skipping food until the next day'],
  ['Hydration during training is mostly…', 'Water, unless the session is long and sweaty', 'Only energy drinks', 'Nothing, so you weigh less'],
  ['A cool-down walk is…', 'An easy way to finish, not a second workout', 'A reason to skip the session', 'The heaviest lift of the day'],
  ['Range of motion should be…', 'As much as you can control without pain', 'As short as possible so the weight looks heavy', 'A bounce at the end of every rep'],
  ['Pairs in a superset should…', 'Still be done with solid form', 'Be rushed until the shape falls apart', 'Replace the need to breathe'],
  ['Writing down the weight you used helps you…', 'Beat or match it next time', 'Forget what you lifted', 'Skip the warm-up'],
  ['A belt can…', 'Add to a brace you already know', 'Replace bracing if you have never learned it', 'Make a round back safe'],
  ['Straps can…', 'Help the grip on pulling lifts', 'Build the chest by themselves', 'Replace leg drive'],
  ['The mirror is useful when it helps you…', 'See the bar path and joint line', 'Chase a heavier ugly rep', 'Ignore pain'],
  ['A spotter is there to…', 'Help if the rep stalls', 'Lift the weight for you from the first rep', 'Add surprise weight'],
  ['Loading a bar on the floor should be…', 'Even on both sides, with clips', 'Heavier on the side you like', 'Left to roll'],
  ['If you feel dizzy under a bar you should…', 'Rack it safely', 'Speed up', 'Hold your breath longer'],
  ['Joints should be…', 'Stacked for the lift you are doing', 'Twisted so the weight swings', 'Locked in a way that hurts'],
  ['A good rep tempo for most lifts is…', 'Controlled down, strong up', 'Dropped down, bounced up', 'Paused for a minute at the bottom every time'],
  ['Muscle is built across…', 'Weeks of repeated hard sessions', 'One brutal workout', 'Only the warm-up'],
  ['Steps and general activity…', 'Add to the energy you use in a day', 'Cancel the need for any food', 'Replace protein'],
  ['A smaller plate or bowl can help when…', 'You want to notice a full serving', 'You are trying to hide vegetables', 'You skip meals entirely'],
  ['Eating protein across the day is…', 'A practical way to hit what you need', 'Useless unless it is only at midnight', 'The same as eating only oil'],
  ['Fruit is…', 'Food with fibre, water, and sugar from the fruit', 'The same thing as a can of soft drink', 'Calorie-free'],
  ['Vegetables at a meal…', 'Add volume for few calories', 'Are the main source of olive oil', 'Replace the protein every time'],
  ['A handful of vegetables does not…', 'Undo a large serve of chips on its own', 'Belong on a plate', 'Bring fibre'],
  ['White rice and brown rice are…', 'Both useful carbs, with brown rice bringing a bit more fibre', 'Identical to a tablespoon of oil', 'Protein powders'],
  ['Pasta after training is…', 'A normal way to refill carbs', 'A mistake because carbs are never useful', 'The same as a soft drink'],
  ['Butter and olive oil are…', 'Both calorie-dense fats', 'Calorie-free if they are spread thin', 'Sources of vitamin C'],
  ['A boiled egg is usually…', 'More filling per calorie than a biscuit', 'Higher in calories than a muffin', 'A cup of oil'],
  ['Skin-on fried chicken is usually…', 'Higher in calories than the same amount of grilled breast', 'Lower in calories than cucumber', 'A vegetable'],
  ['Tomato sauce is usually…', 'Much lighter than mayonnaise', 'The same as a cup of olive oil', 'A protein food'],
  ['Hummus brings…', 'Chickpeas and oil, so the spoon still counts', 'Almost no calories', 'Only water'],
  ['Edamame is…', 'A soy snack with protein', 'A kind of crisp', 'Calorie-free'],
  ['Prawns are…', 'A lean protein', 'Higher in calories than the same weight of nuts', 'A carb like bread'],
  ['Cottage cheese is…', 'A high-protein dairy food', 'Mostly sugar like fruit yogurt', 'An oil'],
  ['Fruit yogurt often has…', 'More sugar, and more calories, than plain yogurt', 'No difference from plain yogurt', 'Less energy than water'],
  ['A rice cake is…', 'A light carb compared with a bagel', 'Higher in calories than instant noodles', 'A protein bar'],
  ['Bacon is…', 'A fatty meat, easy to stack calories', 'The same as a cup of spinach', 'A fruit'],
  ['A sausage is often…', 'Fattier and more calorie-dense than plain chicken breast', 'A low-calorie vegetable', 'Mostly water'],
  ['Quinoa is…', 'A cooked grain with carbs and some protein', 'An oil', 'Calorie-free'],
  ['Sweet potato is…', 'A starchy vegetable, still a carb serving', 'The same calories as a spoon of oil per bite', 'A fat'],
  ['Watermelon is…', 'Mostly water, so a cup stays light', 'As dense as nuts', 'A protein food'],
  ['Pineapple is…', 'A fruit, sweeter and denser than cucumber', 'An oil', 'The same as a chocolate bar per cup'],
  ['Cucumber and spinach are…', 'Very light, so they fill a plate for few calories', 'As dense as granola', 'The same as cheese'],
  ['A latte can…', 'Carry as many calories as a snack once milk is included', 'Match black coffee', 'Count as a workout'],
  ['Black coffee is…', 'Close to calorie-free before milk and sugar', 'The same as a glass of milk', 'A meal'],
  ['Beer and wine…', 'Both bring calories, wine in a smaller glass', 'Have no energy', 'Count as protein'],
  ['Cola is…', 'Sugar and water, with little else useful', 'A sports meal', 'High in protein'],
  ['Protein powder is…', 'A convenient protein, not a whole meal by itself', 'A vegetable', 'Calorie-free'],
  ['Almonds are…', 'Nutrient-dense and easy to overeat by the handful', 'The same as popcorn by the cup', 'Mostly water'],
  ['Peanut butter is…', 'A spoon of fat and some protein, not a free extra', 'Calorie-free because it is spread', 'A drink of water'],
  ['Honey is…', 'Sugar, just from bees', 'A protein', 'Lower in calories than tomato sauce by the spoon'],
];

const TARGET = 1000;

export function buildRestQuiz(): QuizQuestion[] {
  const [more, fewer] = calorieQuestions();
  const packs: [QuizQuestion[], number][] = [
    [exercisePack(), 720],
    [factQuestions(), 160],
    [burnQuestions(), 40],
    [[...estimateQuestions(), ...more, ...fewer], 120],
  ];
  const out: QuizQuestion[] = [];
  const seen = new Set<string>();
  for (const [list, limit] of packs) {
    let used = 0;
    for (const item of list) {
      if (out.length >= TARGET || used >= limit) break;
      const key = `${item.prompt}|${item.choices.join('|')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...item, id: `q${out.length}` });
      used += 1;
    }
  }
  for (const item of exercisePack()) {
    if (out.length >= TARGET) break;
    const key = `${item.prompt}|${item.choices.join('|')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, id: `q${out.length}` });
  }
  return out;
}

export function foodKcal(label: string): number | undefined {
  return FOODS.find((food) => food.label === label)?.kcal;
}

export function burnScore(label: string): number | undefined {
  return BURNS.find((item) => item.label === label)?.score;
}

function factQuestions(): QuizQuestion[] {
  return FACTS.flatMap((fact, index) => {
    const [prompt, correct, wrongA, wrongB] = fact;
    const question = ask(`fact-${index}`, prompt, correct, wrongA, wrongB);
    return question ? [question] : [];
  });
}

function exercisePack(): QuizQuestion[] {
  const muscles = unique(LIFTS.map((lift) => lift.muscle));
  const patterns = unique(LIFTS.map((lift) => lift.pattern));
  const tools = unique(LIFTS.map((lift) => lift.tool));
  const out: QuizQuestion[] = [];
  LIFTS.forEach((lift, index) => {
    const [muscleA, muscleB] = twoOthers(muscles, lift.muscle, index);
    const [patternA, patternB] = twoOthers(patterns, lift.pattern, index + 1);
    const [toolA, toolB] = twoOthers(tools, lift.tool, index + 2);
    push(out, ask(`area-${index}`, `Which area does a ${lift.name} mainly train?`, lift.muscle, muscleA, muscleB));
    push(out, ask(`pattern-${index}`, `A ${lift.name} is mainly which kind of movement?`, lift.pattern, patternA, patternB));
    push(out, ask(`tool-${index}`, `A ${lift.name} is usually done with…`, lift.tool, toolA, toolB));
    const otherMuscles = LIFTS.filter((item) => item.muscle !== lift.muscle);
    const otherPatterns = LIFTS.filter((item) => item.pattern !== lift.pattern);
    for (let n = 0; n < 8; n += 1) {
      const wrongA = otherMuscles[(index * 3 + n * 5) % otherMuscles.length];
      const wrongB = otherMuscles[(index * 3 + n * 5 + 4) % otherMuscles.length];
      if (!wrongA || !wrongB || wrongA.name === wrongB.name) continue;
      const prompts = [
        `Which exercise mainly trains the ${lift.muscle}?`,
        `Which of these mainly trains the ${lift.muscle}?`,
        `Pick the ${lift.muscle} exercise.`,
      ];
      push(
        out,
        ask(
          `pick-${index}-${n}`,
          prompts[n % prompts.length] ?? prompts[0]!,
          lift.name,
          wrongA.name,
          wrongB.name,
        ),
      );
    }
    for (let n = 0; n < 5; n += 1) {
      const wrongA = otherPatterns[(index + n * 4) % otherPatterns.length];
      const wrongB = otherPatterns[(index + n * 4 + 6) % otherPatterns.length];
      if (!wrongA || !wrongB || wrongA.name === wrongB.name) continue;
      const prompt = lift.pattern === 'core' ? 'Which of these is mainly core work?' : `Which of these is mainly a ${lift.pattern}?`;
      push(out, ask(`kind-${index}-${n}`, prompt, lift.name, wrongA.name, wrongB.name));
    }
  });
  return out;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function twoOthers(pool: string[], current: string, salt: number): [string, string] {
  const rest = pool.filter((item) => item !== current);
  const first = rest[salt % rest.length] ?? rest[0] ?? 'other';
  const second = rest[(salt + 3) % rest.length] ?? rest[1] ?? 'another';
  return first === second ? [first, rest[(salt + 1) % rest.length] ?? 'another'] : [first, second];
}

function push(bucket: QuizQuestion[], question: QuizQuestion | null) {
  if (question) bucket.push(question);
}

function estimateQuestions(): QuizQuestion[] {
  return FOODS.flatMap((food) => {
    if (food.kcal < 40) return [];
    const low = Math.max(10, Math.round((food.kcal * 0.4) / 10) * 10);
    const high = Math.round((food.kcal * 2.3) / 10) * 10;
    if (new Set([food.kcal, low, high]).size < 3) return [];
    if (Math.abs(low - food.kcal) < 30 || high - food.kcal < 40) return [];
    const question = ask(
      `est-${food.label}`,
      `About how many calories is ${food.label}?`,
      `${food.kcal} kcal`,
      `${low} kcal`,
      `${high} kcal`,
    );
    return question ? [question] : [];
  });
}

function burnQuestions(): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (let i = 0; i < BURNS.length; i += 1) {
    for (let j = i + 1; j < BURNS.length; j += 1) {
      for (let k = j + 1; k < BURNS.length; k += 1) {
        const trio = [BURNS[i]!, BURNS[j]!, BURNS[k]!];
        const ranked = [...trio].sort((a, b) => b.score - a.score);
        const top = ranked[0]!;
        const mid = ranked[1]!;
        if (top.score < mid.score + 3) continue;
        const others = trio.filter((item) => item !== top);
        const question = ask(`burn-${i}-${j}-${k}`, 'Which usually burns more calories for the same person?', top.label, others[0]!.label, others[1]!.label);
        if (question) out.push(question);
        if (out.length >= 80) return out;
      }
    }
  }
  return out;
}

const MORE_PROMPTS = [
  'Which usually has more calories?',
  'Which of these usually has more calories?',
  'Which serving usually has more calories?',
  'Pick the option with more calories.',
];

const FEWER_PROMPTS = [
  'Which usually has fewer calories?',
  'Which of these usually has fewer calories?',
  'Which serving usually has fewer calories?',
  'Pick the option with fewer calories.',
];

function calorieQuestions(): [QuizQuestion[], QuizQuestion[]] {
  const more: QuizQuestion[] = [];
  const fewer: QuizQuestion[] = [];
  const seen = new Map<string, number>();
  const triples: [number, number, number][] = [];
  for (let i = 0; i < FOODS.length; i += 1) {
    for (let j = i + 1; j < FOODS.length; j += 1) {
      for (let k = j + 1; k < FOODS.length; k += 1) triples.push([i, j, k]);
    }
  }
  shuffleTriples(triples, 20261027);
  for (const [i, j, k] of triples) {
    if (more.length >= 400 && fewer.length >= 400) break;
    const trio = [FOODS[i]!, FOODS[j]!, FOODS[k]!];
    if (trio.some((food) => (seen.get(food.label) ?? 0) >= 36)) continue;
    const high = [...trio].sort((a, b) => b.kcal - a.kcal);
    const low = [...trio].sort((a, b) => a.kcal - b.kcal);
    const clearHigh = high[0]!.kcal >= high[1]!.kcal * 1.35 && high[0]!.kcal - high[1]!.kcal >= 50;
    const clearLow = low[1]!.kcal >= low[0]!.kcal * 1.35 && low[1]!.kcal - low[0]!.kcal >= 40;
    const preferMore = more.length <= fewer.length;
    const added = preferMore
      ? pushCalorie(more, 'more', MORE_PROMPTS, i, j, k, clearHigh ? high[0]! : null, trio) ||
        pushCalorie(fewer, 'fewer', FEWER_PROMPTS, i, j, k, clearLow ? low[0]! : null, trio)
      : pushCalorie(fewer, 'fewer', FEWER_PROMPTS, i, j, k, clearLow ? low[0]! : null, trio) ||
        pushCalorie(more, 'more', MORE_PROMPTS, i, j, k, clearHigh ? high[0]! : null, trio);
    if (!added) continue;
    for (const food of trio) seen.set(food.label, (seen.get(food.label) ?? 0) + 1);
  }
  return [more, fewer];
}

function pushCalorie(
  bucket: QuizQuestion[],
  kind: string,
  prompts: readonly string[],
  i: number,
  j: number,
  k: number,
  winner: Food | null,
  trio: Food[],
): boolean {
  if (!winner || bucket.length >= 400) return false;
  const others = trio.filter((food) => food !== winner);
  const prompt = prompts[bucket.length % prompts.length] ?? prompts[0]!;
  const question = ask(`${kind}-${i}-${j}-${k}`, prompt, winner.label, others[0]!.label, others[1]!.label);
  if (!question) return false;
  bucket.push(question);
  return true;
}

function shuffleTriples(triples: [number, number, number][], seed: number) {
  let state = seed >>> 0 || 1;
  for (let index = triples.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swap = Math.floor((state / 4294967296) * (index + 1));
    const current = triples[index]!;
    triples[index] = triples[swap]!;
    triples[swap] = current;
  }
}

function ask(id: string, prompt: string, correct: string, wrongA: string, wrongB: string): QuizQuestion | null {
  if (new Set([correct, wrongA, wrongB]).size < 3) return null;
  const choices = [correct, wrongA, wrongB];
  const shift = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  for (let i = 0; i < shift; i += 1) {
    const first = choices.shift();
    if (first) choices.push(first);
  }
  return { id, prompt, choices, answer: choices.indexOf(correct) };
}
