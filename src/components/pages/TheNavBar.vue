<template>
  <nav class="navbar navbar-expand-sm navbar-light bg-light sticky-top">
    <div class="container-fluid">
      <router-link class="navbar-brand" to="/">Task Manager</router-link>

      <button
        class="navbar-toggler ms-auto"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarNav"
        aria-controls="navbarNav"
        aria-expanded="false"
        aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav mx-auto">
          <li class="nav-item">
            <router-link class="nav-link" to="/">Dashboard</router-link>
          </li>
          <li class="nav-item dropdown">
            <button ref="groupsDropdown" class="btn dropdown-toggle" @click="toggleDropdown('groups')" :aria-expanded="dropdownStates.groups">Groups</button>
            <ul class="dropdown-menu" :class="{ show: dropdownStates.groups }">
              <li v-if="allGroups.length === 0">
                <span class="dropdown-item-text">No groups found</span>
              </li>
              <li v-for="group in allGroups" :key="group.code">
                <a class="dropdown-item" @click="selectGroup(group)">
                  <i v-if="isOwner(group)" class="fa-solid fa-user-tie ms-1"></i>
                  <i v-else class="fa-solid fa-users ms-1"></i>
                  {{ group.name }}
                </a>
              </li>
            </ul>
          </li>
          <li class="nav-item dropdown">
            <button ref="filterDropdown" class="btn dropdown-toggle" @click="toggleDropdown('filter')" :aria-expanded="dropdownStates.filter">Filter</button>
            <ul class="dropdown-menu" :class="{ show: dropdownStates.filter }">
              <li v-for="status in statuses" :key="status">
                <router-link to="/filtered" class="dropdown-item" @click="selectFilter(status)">
                  {{ status }}
                </router-link>
              </li>
            </ul>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/statistics">Statistics</router-link>
          </li>
          <li class="nav-item">
            <button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#createGroupModal">Create / Join Group</button>
          </li>
        </ul>

        <div class="d-flex align-items-center ms-auto">
          <router-link to="/profile" class="d-flex align-items-center text-decoration-none text-dark">
            <i class="fas fa-user-circle m-lg-2" style="font-size: 24px"></i>
            <button v-if="authStore.user" @click="handleLogout" class="btn btn-outline-danger d-flex align-items-center">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </router-link>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, ref, reactive, nextTick } from "vue";
import { useGroupStore } from "@/stores/groupStore";
import { useAuthStore } from "@/stores/authStore";
import { Toaster, toast } from "vue-sonner";
import { useRouter } from "vue-router";

const groupStore = useGroupStore();
const router = useRouter();
const authStore = useAuthStore();

// Reactive state for dropdowns
const dropdownStates = reactive({
  groups: false,
  filter: false,
});

// Template refs
const groupsDropdown = ref<HTMLElement | null>(null);
const filterDropdown = ref<HTMLElement | null>(null);

const allGroups = computed(() => {
  const seen = new Set();
  return [...groupStore.ownedGroups, ...groupStore.joinedGroups].filter((group) => {
    if (seen.has(group.code)) {
      return false;
    }
    seen.add(group.code);
    return true;
  });
});

const isOwner = (group: { code: string }) => {
  return groupStore.ownedGroups.some((ownedGroup) => ownedGroup.code === group.code);
};

const handleLogout = async () => {
  await authStore.logout();
  toast.info("Logged out");
  router.push("/login");
};

const statuses: string[] = ["To Do", "In Progress", "Completed", "Blocked", "On Hold", "Your Tasks"];

// Manual dropdown handling
const toggleDropdown = (dropdownName: "groups" | "filter") => {
  // Zamknij wszystkie inne dropdowns
  Object.keys(dropdownStates).forEach((key) => {
    if (key !== dropdownName) {
      dropdownStates[key as keyof typeof dropdownStates] = false;
    }
  });

  // Toggle current dropdown
  dropdownStates[dropdownName] = !dropdownStates[dropdownName];
};

const selectGroup = (group: any) => {
  groupStore.setSelectedGroup(group);
  dropdownStates.groups = false;
};

const selectFilter = (status: string) => {
  groupStore.selectedStatus = status;
  dropdownStates.filter = false;
};

// Close dropdowns when clicking outside
const handleClickOutside = (event: Event) => {
  const target = event.target as HTMLElement;

  if (groupsDropdown.value && !groupsDropdown.value.closest(".dropdown")?.contains(target)) {
    dropdownStates.groups = false;
  }

  if (filterDropdown.value && !filterDropdown.value.closest(".dropdown")?.contains(target)) {
    dropdownStates.filter = false;
  }
};

onMounted(async () => {
  console.log("NavBar mounted, fetching groups...");
  await groupStore.fetchGroups();
  console.log("After fetchGroups - Owned groups:", groupStore.ownedGroups);
  console.log("After fetchGroups - Joined groups:", groupStore.joinedGroups);

  // Add click outside listener
  document.addEventListener("click", handleClickOutside);

  // Initialize Bootstrap manually if available
  nextTick(() => {
    if (window.bootstrap) {
      console.log("Bootstrap available, initializing dropdowns");
      try {
        const dropdownElementList = document.querySelectorAll(".dropdown-toggle");
        const dropdownList = [...dropdownElementList].map((dropdownToggleEl) => new window.bootstrap.Dropdown(dropdownToggleEl));
        console.log("Initialized", dropdownList.length, "dropdowns");
      } catch (error) {
        console.log("Manual dropdown handling will be used");
      }
    } else {
      console.log("Bootstrap not available, using manual dropdown handling");
    }
  });
});

// Cleanup
import { onUnmounted } from "vue";
onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});

// Watch auth state changes
watch(
  () => authStore.user,
  (newUser) => {
    console.log("Auth state changed:", !!newUser);
    if (newUser) {
      groupStore.fetchGroups();
    }
  }
);
</script>

<style scoped>
/* Dodaj style dla manual dropdown handling */
.dropdown-menu.show {
  display: block;
}

.dropdown-toggle {
  background: none;
  border: none;
  color: rgba(0, 0, 0, 0.55);
  text-decoration: none;
  padding: 0.5rem 1rem;
}

.dropdown-toggle:hover {
  color: rgba(0, 0, 0, 0.7);
}

.dropdown-toggle:focus {
  outline: none;
}

.dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  min-width: 10rem;
  padding: 0.5rem 0;
  margin: 0;
  font-size: 1rem;
  color: #212529;
  text-align: left;
  background-color: #fff;
  background-clip: padding-box;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 0.375rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.175);
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 0.25rem 1rem;
  clear: both;
  font-weight: 400;
  color: #212529;
  text-align: inherit;
  text-decoration: none;
  white-space: nowrap;
  background-color: transparent;
  border: 0;
  cursor: pointer;
}

.dropdown-item:hover {
  color: #1e2125;
  background-color: #e9ecef;
}

.dropdown-item-text {
  display: block;
  padding: 0.25rem 1rem;
  color: #6c757d;
}
</style>
