/* Recorridos con ejemplos en memoria. No crea cuentas ni realiza solicitudes a la API. */
(() => {
  'use strict';
  function create({ slug, kind, name }) {
    let active = false;
    let serial = 200;
    let observer;
    const user = { id: -1, account: -1, name: 'Invitado de muestra', email: 'tucorreo@ejemplo.test', role: 'Muestra', can_manage: true, is_matrix: false, is_demo: true, must_change_password: false };
    const courses = [{ id: 101, slug: 'curso-de-muestra', name: 'Un curso para explorar', description: 'Probá cómo se organizan las clases y el avance de los alumnos.', active: true, preview: true, lessons: [{ id: 102, title: 'Tu primera clase', description: 'Contenido ilustrativo', content: 'Este contenido es de ejemplo. Podés recorrer el aula y probar sus controles sin crear una cuenta.', lesson_type: 'theory', active: true, sort_order: 0, duration_minutes: 5, materials: [], completed: false, links: [], reflection_questions: ['¿Qué te resultó más útil?', '¿Qué te gustaría practicar?'] }] }];
    const students = [{ id: 103, name: 'Alumno de muestra', email: 'alumno@ejemplo.test' }];
    const products = [{ id: 104, name: 'Producto de muestra', description: 'Artículo ilustrativo', sale_price: 2500, category: 'Ejemplos', active: true }];
    const settings = { primary_color: '#6254c7', tagline: 'Una muestra para explorar', store_promotion: {} };
    const drafts = [];
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    function examples(root = document) {
      if (!active) return;
      root.querySelectorAll('input[type="password"]').forEach(input => { input.value = 'Ejemplo!'; input.readOnly = true; input.autocomplete = 'off'; });
      root.querySelectorAll('input[type="email"]').forEach(input => { if (!input.value) input.value = 'alumno@ejemplo.test'; });
    }
    const summaries = () => courses.map(course => ({ ...course, lessons_count: course.lessons.length, completed_lessons: course.lessons.filter(lesson => lesson.completed).length, progress_percent: 0 }));
    const course = key => courses.find(item => item.slug === decodeURIComponent(key));
    async function fetchLocal(url, options = {}) {
      if (!active) throw Error('La muestra no está iniciada.');
      const parsed = new URL(url, location.href);
      const prefix = '/portales/' + encodeURIComponent(slug);
      const path = parsed.pathname.replace(/^\/api/, '');
      if (path !== prefix && !path.startsWith(prefix + '/')) return json({ message: 'Esta operación no pertenece a la muestra.' }, 403);
      const route = path.slice(prefix.length);
      const method = String(options.method || 'GET').toUpperCase();
      let data = options.body;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return json({ message: 'Datos de muestra no válidos.' }, 422); } }
      if (data instanceof FormData) data = Object.fromEntries(data.entries());
      data = data || {};
      if (route === '/auth/me') return json({ user });
      if (route === '/auth/logout') return json({ message: 'Muestra finalizada.' });
      if (route === '/brand') return json({ name, public_preview: true, demo_available: true, nautical: false });
      if (route.startsWith('/auth/')) return json({ message: 'La muestra no utiliza contraseñas ni envía correos.' }, 403);
      if (route === '/manage' && method === 'GET') return json({ name, settings, courses: summaries(), students, products, orders: [], stage: 'demo', nautical: { location_name: 'Ubicación de muestra', latitude: -31.716, longitude: -60.504 } });
      if (route === '/learning/courses') return json({ courses: summaries() });
      let match = route.match(/^\/learning\/courses\/([^/]+)$/);
      if (match) return course(match[1]) ? json({ course: course(match[1]) }) : json({ message: 'Curso de muestra no encontrado.' }, 404);
      if (/\/assessment$/.test(route)) return json({ exam: null, attempts: [], complete: false, message: 'Muestra sin evaluaciones formales.' });
      if (/\/reflection$/.test(route) || /\/complete$/.test(route)) return json({ message: 'Acción simulada. No se guardó un avance real.' });
      if (/\/certificate$|\/materials\/\d+$/.test(route)) return json({ message: 'La muestra no utiliza archivos privados ni emite certificados.' }, 403);
      if (route === '/manage/guided/drafts') return json({ drafts });
      if (/\/responses$/.test(route)) return json({ responses: [] });
      match = route.match(/^\/manage\/guided\/courses\/([^/]+)\/prepare$/);
      if (match) {
        const draft = { id: ++serial, title: 'Clase de muestra', description: 'Preparación ilustrativa para revisar', content: typeof data.content === 'string' && data.content ? data.content : 'Contenido de ejemplo. En un aula real se procesa el documento del profesor.', links: [], reflection_questions: ['¿Qué aprendiste?', '¿Qué practicarías?'], lesson_type: data.lesson_type || 'theory', course_slug: decodeURIComponent(match[1]), warning: 'Muestra: no se suben ni se procesan archivos. Usá información de ejemplo.' };
        drafts.push(draft); return json({ draft }, 201);
      }
      match = route.match(/^\/manage\/guided\/drafts\/(\d+)$/);
      if (match) return json({ draft: drafts.find(item => item.id === Number(match[1])) });
      match = route.match(/^\/manage\/(?:guided\/)?courses\/([^/]+)\/lessons(?:\/(\d+))?$/);
      if (match && ['POST', 'PUT'].includes(method)) {
        const selected = course(match[1]); if (!selected) return json({ message: 'Elegí un curso de muestra.' }, 404);
        const draft = drafts.find(item => item.id === Number(data.draft_id));
        let lesson = selected.lessons.find(item => item.id === Number(match[2] || data.lesson_id));
        if (!lesson) { lesson = { id: ++serial, materials: [], links: [], reflection_questions: [], active: true }; selected.lessons.push(lesson); }
        Object.assign(lesson, draft || {}, data); return json({ message: 'Clase simulada. Se conserva hasta salir de la muestra.', lesson });
      }
      if (route === '/manage/courses' && method === 'POST') { const added = { ...data, id: ++serial, lessons: [] }; courses.push(added); return json({ course: added }); }
      match = route.match(/^\/manage\/courses\/([^/]+)$/);
      if (match && method === 'PUT') { const selected = course(match[1]); if (selected) Object.assign(selected, data); return json({ course: selected }); }
      if (/\/enroll$|\/materials$/.test(route)) return json({ message: 'Acción simulada con datos de ejemplo.' });
      if (route === '/manage/students' && method === 'POST') { const student = { id: ++serial, name: data.name || 'Alumno de muestra', email: data.email || 'alumno@ejemplo.test' }; students.push(student); return json({ id: student.id, message: 'Alumno de ejemplo agregado.' }); }
      if (route === '/manage/settings' && method === 'PUT') { Object.assign(settings, data); return json({ message: 'Cambios de ejemplo aplicados.' }); }
      if (route === '/manage/products' && method === 'POST') { products.push({ ...data, id: ++serial }); return json({ message: 'Producto de ejemplo agregado.' }); }
      match = route.match(/^\/manage\/products\/(\d+)$/);
      if (match && method === 'PUT') { const selected = products.find(item => item.id === Number(match[1])); if (selected) Object.assign(selected, data); return json({ message: 'Producto de ejemplo actualizado.' }); }
      return json({ message: 'Esta función requiere una cuenta real. La muestra no modificó datos del sistema.' }, 403);
    }
    return {
      get active() { return active; }, user,
      start() { active = true; examples(); observer = new MutationObserver(() => examples()); observer.observe(document.body, { childList: true, subtree: true }); return user; },
      stop() { active = false; observer?.disconnect(); },
      fetch: fetchLocal,
    };
  }
  window.DatalistingDemo = { create };
})();
