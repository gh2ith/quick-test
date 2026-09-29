# Bridgeway HR Management System

> A comprehensive, modern HR Operations and Workforce Management platform engineered with HTML5, CSS3, Bootstrap 5, vanilla JavaScript, and LocalStorage data architecture.

---

## 🌟 Project Highlights

- **Interactive Guest Journey**: A scroll-controlled interactive roadmap (`index.html` + `landing-journey.js` + `landing-journey.css`) featuring a dynamic camera model, 9 distinct milestones, and zero section overlap.
- **Strict Role-Based Access Control (RBAC)**:
  - **Employee Portal**: Personal profile inspection & permitted edits (photo & phone), assigned sprint tasks with solution submissions, leave applications, company policies handbook, direct feedback, and Jitsi team meetings.
  - **HR Admin Console**: Staff directory management (exclusive employee provisioning, search, filter, edit, delete), sprint task delegation & review loops (Approve / Request Changes with notes), leave approval queue (approve/reject), read-only policies, feedback inbox, and meeting room management.
  - **Zero Public Self-Registration**: In compliance with enterprise security requirements, new accounts are created exclusively by HR.
- **Static & Local-First Architecture**: Powered entirely by client-side JSON data structures and persistent browser `localStorage`.
- **Complete Design System**: Built with modern executive White & Royal Blue design tokens documented in [`DESIGN.md`](./DESIGN.md).

---

## 🚀 Live Demo & How to Run

1. Clone or download this repository:
   ```bash
   git clone https://github.com/gh2ith/quick-test.git
   cd quick-test
   ```
2. Serve locally using Python's built-in HTTP server:
   ```bash
   python -m http.server 8080
   ```
3. Open in your browser:
   ```
   http://localhost:8080/index.html
   ```

---

## 👥 Demo Credentials

| Role | Name | Email | Employee ID | Department | Initial View |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Employee** | Sarah Jenkins | `sarah.jenkins@bridgeway.corp` | `#EMP-2041` | Technology / Product | Employee Workspace |
| **HR Director** | Alex Vance | `alex.vance@bridgeway.corp` | `#HR-1001` | People Operations | HR Admin Console |

---

## 🧭 Navbar Specification (Locked Contract)

The application adheres to a single locked navbar specification across all pages with three role-specific variants:

### 1. Guest Navbar (Public / Unauthenticated)
- **Brand Logo**: `Bridgeway HR`
- **Navigation Links**:
  - `Home` (`#stop-0`)
  - `About` (`#stop-1`)
  - `Services` (`#stop-2`)
  - `Contact Us` (`#stop-7`)
- **Right Action**: `Sign In →` (Triggers role-selection login gate)

### 2. Employee Navbar (Authenticated Staff)
- **Brand Logo**: `Bridgeway HR`
- **Navigation Links**:
  - `Home` / `Dashboard`
  - `Profile`
  - `Services` (Dropdown: *Leave Application*, *My Tasks*, *Policies*, *Meetings*)
  - `About`
  - `Contact Us`
- **User Element**: Avatar Pill with `Sarah Jenkins` + `EMPLOYEE` badge + `Logout`

### 3. HR Admin Navbar (Authenticated Human Resources)
- **Brand Logo**: `Bridgeway HR`
- **Navigation Links**:
  - `Home` / `Console`
  - `Employees` (Staff Directory)
  - `Services` (Dropdown: *Task Delegation*, *Leave Approvals*, *Company Policies*, *Feedback Inbox*, *Meetings*)
  - `About`
  - `Contact Us`
- **User Element**: Avatar Pill with `Alex Vance` + `HR ADMIN` badge + `Logout`

---

## 📁 Design Mockups & Wireframe Index

All design assets are located in the [`mockups/svg/`](./mockups/svg/) directory:

| File Name | Description | Fidelity |
| :--- | :--- | :--- |
| `01_landing_guest.svg` | Guest Landing Page (Hero, Operational Preview, Services Grid, About, Footer) | High-Fidelity |
| `02_login_page.svg` | Portal Authentication Gate with JavaScript validation states | High-Fidelity |
| `03_landing_employee.svg` | Employee Home Dashboard (Sprint overview, upcoming meetings, quick actions) | High-Fidelity |
| `04_landing_hr.svg` | HR Director Command Console (Pending leaves, task status, feedback notifications) | High-Fidelity |
| `05_employee_profile.svg` | Employee Profile Page (Read-only vs editable phone/photo fields) | High-Fidelity |
| `06_employee_leaves.svg` | Employee Leave Application (Annual, Sick, Early Departure, Unpaid) | High-Fidelity |
| `07_employee_tasks.svg` | Employee Tasks Board (Active sprint tasks, deliverable submission form) | High-Fidelity |
| `08_company_policies.svg` | Company Policies Handbook (Filter chips: Conduct, Hours, Remote, Leave, Security) | High-Fidelity |
| `09_hr_employee_directory.svg`| HR Staff Directory (Search, Department filters, Add/Edit/Delete actions) | High-Fidelity |
| `10_hr_leave_approvals.svg` | HR Leave Approvals Queue (Approve/Reject actions with status sync) | High-Fidelity |
| `11_hr_task_management.svg` | HR Task Delegation & Solution Review Board | High-Fidelity |
| `12_hr_feedback_inbox.svg` | HR Feedback Inbox (Review inquiries submitted from footer form) | High-Fidelity |
| `13_employee_meetings.svg` | Employee Upcoming Meetings List with Join Meeting buttons | High-Fidelity |
| `14_about_page.svg` | About Page with dedicated Project Team Member cards | High-Fidelity |
| `15_contact_us.svg` | Contact Us Page with text details, interactive map, and inquiry form | High-Fidelity |
| `16_hr_create_edit_task.svg` | HR Create / Edit Task Form modal (Priority, Due Date, Employee Assignee) | High-Fidelity |
| `17_hr_meetings.svg` | HR Meetings Scheduling Desk (Jitsi room configuration & attendee list) | High-Fidelity |
| `18_meeting_room.svg` | Embedded Jitsi Video Conference Room Interface | High-Fidelity |
| `19_hr_employee_modals.svg` | Add / Edit Employee Modal & Delete Confirmation Dialog | High-Fidelity |
| `20_hr_company_policies.svg` | HR Read-Only Company Policies Handbook | High-Fidelity |
| `21_validation_states.svg` | Form Validation States (Empty fields, invalid email, wrong credentials) | High-Fidelity |
| `22_mobile_landing_guest.svg`| Mobile Viewport (375px) Guest Landing Journey | Responsive Mockup |
| `23_mobile_login.svg` | Mobile Viewport (375px) Login Screen | Responsive Mockup |
| `24_mobile_employee_tasks.svg`| Mobile Viewport (375px) Employee Tasks Interface | Responsive Mockup |
| `25_mobile_meeting_room.svg` | Mobile Viewport (375px) Jitsi Meeting Room Interface | Responsive Mockup |
| `26_tablet_employee_directory.svg` | Tablet Viewport (768px) HR Employee Directory Interface | Responsive Mockup |
| `27_lowfi_wireframes.svg` | Grayscale Schematic Blueprints (6 core layouts: Guest, Login, Dashboards, Video) | Low-Fidelity |

---

## 🔗 Project Links

- **Figma Design Board**: *(Figma project link to be placed here)*
- **Trello Workflow Board**: *(Trello board link to be placed here)*

---

## 📄 License & Academic Attribution
Developed as an enterprise-grade university frontend coursework project. Designed and implemented using semantic HTML5, modern CSS3, Bootstrap 5, and vanilla JavaScript.
